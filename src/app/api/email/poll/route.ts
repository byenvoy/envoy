import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { emailConnections, knowledgeBaseChunks } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { tryAdvisoryLock, advisoryUnlock, getOrgSubscription, isActiveSubscription } from "@/lib/db/helpers";
import { pollConnection } from "@/lib/email/imap-poll";
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
  const lockAcquired = await tryAdvisoryLock(73501);

  if (!lockAcquired) {
    return NextResponse.json({ error: "Poll already in progress" }, { status: 409 });
  }

  try {
    const connections = await db
      .select()
      .from(emailConnections)
      .where(eq(emailConnections.status, "active"));

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

        // Skip polling if org has no KB chunks — no point ingesting emails
        // before the knowledge base is set up. UIDs won't advance, so emails
        // will be picked up on the first poll after KB sources are added.
        const chunkCount = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(knowledgeBaseChunks)
          .where(eq(knowledgeBaseChunks.orgId, conn.orgId))
          .then((r) => r[0]?.count ?? 0);

        if (chunkCount === 0) {
          continue;
        }

        const created = await pollConnection(conn);
        conversationsCreated += created ? 1 : 0;
        polled++;
      } catch (err) {
        console.error(`Poll error for connection ${conn.id}:`, err);
        errors++;
        await db
          .update(emailConnections)
          .set({
            status: "error",
            errorMessage: err instanceof Error ? err.message : "Unknown error",
            updatedAt: new Date(),
          })
          .where(eq(emailConnections.id, conn.id));
      }
    }

    return NextResponse.json({ polled, errors, conversations_processed: conversationsCreated });
  } finally {
    await advisoryUnlock(73501);
  }
}
