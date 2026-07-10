import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { emailConnections, organizations } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { tryAdvisoryLock, getOrgSubscription, isActiveSubscription } from "@/lib/db/helpers";
import { pollConnection } from "@/lib/email/imap-poll";
import { TokenRevokedError } from "@/lib/email/oauth-tokens";
import { isCloud } from "@/lib/config";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Advisory lock to prevent concurrent poll runs
  const lock = await tryAdvisoryLock(73501);

  if (!lock) {
    return NextResponse.json({ error: "Poll already in progress" }, { status: 409 });
  }

  try {
    const connections = await db
      .select()
      .from(emailConnections)
      .where(inArray(emailConnections.status, ["active", "error"]));

    let polled = 0;
    let errors = 0;
    let conversationsCreated = 0;

    for (const conn of connections) {
      try {
        if (isCloud()) {
          const sub = await getOrgSubscription(conn.orgId);
          if (!sub || !isActiveSubscription(sub.status)) {
            continue;
          }
        }

        // Skip polling if org hasn't enabled it yet — user opts in after
        // setting up their knowledge base. UIDs won't advance, so emails
        // will be picked up on the first poll after polling is enabled.
        const org = await db
          .select({ pollingEnabled: organizations.pollingEnabled })
          .from(organizations)
          .where(eq(organizations.id, conn.orgId))
          .then((r) => r[0]);

        if (!org?.pollingEnabled) {
          continue;
        }

        const created = await pollConnection(conn);
        conversationsCreated += created ? 1 : 0;
        polled++;
      } catch (err) {
        console.error(`Poll error for connection ${conn.id}:`, err);
        errors++;
        // A revoked refresh token never self-recovers — mark the connection
        // 'revoked' so the poller stops selecting it (it filters to
        // active/error) instead of retrying and re-logging every cycle. The
        // reconnect flow resets it to 'active'.
        await db
          .update(emailConnections)
          .set({
            status: err instanceof TokenRevokedError ? "revoked" : "error",
            errorMessage: err instanceof Error ? err.message : "Unknown error",
            updatedAt: new Date(),
          })
          .where(eq(emailConnections.id, conn.id));
      }
    }

    return NextResponse.json({ polled, errors, conversations_processed: conversationsCreated });
  } finally {
    await lock.release();
  }
}
