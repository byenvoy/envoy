import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { emailConnections, organizations } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { withAuth } from "@/lib/db/helpers/auth";
import { tryAdvisoryLock, advisoryUnlock } from "@/lib/db/helpers";
import { getOrgSubscription, isActiveSubscription } from "@/lib/db/helpers";
import { pollConnection } from "@/lib/email/imap-poll";
import { isCloud } from "@/lib/config";

const POLL_COOLDOWN_MS = 30_000; // 30 seconds

export async function POST() {
  const auth = await withAuth();
  if (!auth.success) return auth.response;

  const { orgId } = auth.context;

  // Subscription check (cloud only)
  if (isCloud()) {
    const sub = await getOrgSubscription(orgId);
    if (!sub || !isActiveSubscription(sub.status)) {
      return NextResponse.json({ error: "Active subscription required" }, { status: 403 });
    }
  }

  // Check polling is enabled for this org
  const org = await db
    .select({ pollingEnabled: organizations.pollingEnabled })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .then((r) => r[0]);

  if (!org?.pollingEnabled) {
    return NextResponse.json({ error: "Polling not enabled" }, { status: 400 });
  }

  // Get org's active email connection
  const connection = await db
    .select()
    .from(emailConnections)
    .where(and(eq(emailConnections.orgId, orgId), inArray(emailConnections.status, ["active", "error"])))
    .then((r) => r[0]);

  if (!connection) {
    return NextResponse.json({ error: "No active email connection" }, { status: 404 });
  }

  // Rate limit: reject if polled less than 30s ago
  if (connection.lastPolledAt) {
    const elapsed = Date.now() - new Date(connection.lastPolledAt).getTime();
    if (elapsed < POLL_COOLDOWN_MS) {
      return NextResponse.json(
        { error: "Too soon", retryAfter: Math.ceil((POLL_COOLDOWN_MS - elapsed) / 1000) },
        { status: 429 }
      );
    }
  }

  // Acquire advisory lock (same as cron — prevents concurrent polls)
  const lockAcquired = await tryAdvisoryLock(73501);
  if (!lockAcquired) {
    return NextResponse.json({ error: "Poll already in progress" }, { status: 409 });
  }

  try {
    const processed = await pollConnection(connection);
    return NextResponse.json({ polled: true, newMessages: processed });
  } catch (err) {
    console.error(`Manual poll error for org ${orgId}:`, err);
    await db
      .update(emailConnections)
      .set({
        status: "error",
        errorMessage: err instanceof Error ? err.message : "Unknown error",
        updatedAt: new Date(),
      })
      .where(eq(emailConnections.id, connection.id));
    return NextResponse.json({ error: "Poll failed" }, { status: 500 });
  } finally {
    await advisoryUnlock(73501);
  }
}
