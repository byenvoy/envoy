import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { knowledgeBasePages } from "@/lib/db/schema";
import { eq, and, inArray, isNotNull } from "drizzle-orm";
import {
  tryAdvisoryLock,
  advisoryUnlock,
  enqueueCrawlJob,
  hasActiveRecrawlJob,
  getOrgSubscription,
  isActiveSubscription,
} from "@/lib/db/helpers";
import { isCloud } from "@/lib/stripe";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const lockAcquired = await tryAdvisoryLock(73502);
  if (!lockAcquired) {
    return NextResponse.json(
      { error: "Recrawl enqueue already in progress" },
      { status: 409 }
    );
  }

  try {
    const orgs = await db
      .selectDistinct({ orgId: knowledgeBasePages.orgId })
      .from(knowledgeBasePages)
      .where(
        and(
          eq(knowledgeBasePages.isActive, true),
          isNotNull(knowledgeBasePages.url),
          inArray(knowledgeBasePages.source, ["crawled", "url"])
        )
      );

    let jobsEnqueued = 0;

    for (const { orgId } of orgs) {
      if (isCloud()) {
        const sub = await getOrgSubscription(orgId);
        if (!sub || !isActiveSubscription(sub.status)) continue;
      }

      const hasActive = await hasActiveRecrawlJob(orgId);
      if (hasActive) continue;

      await enqueueCrawlJob(orgId, "recrawl");
      jobsEnqueued++;
    }

    return NextResponse.json({ jobsEnqueued });
  } finally {
    await advisoryUnlock(73502);
  }
}
