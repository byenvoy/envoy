import cron from "node-cron";
import { db } from "@/lib/db";
import { knowledgeBasePages } from "@/lib/db/schema";
import { eq, and, inArray, isNotNull } from "drizzle-orm";
import {
  claimNextJob,
  resetStaleJobs,
  enqueueCrawlJob,
  hasActiveRecrawlJob,
} from "@/lib/db/helpers/crawl-jobs";
import { tryAdvisoryLock, advisoryUnlock } from "@/lib/db/helpers/advisory-lock";
import { getOrgSubscription, isActiveSubscription } from "@/lib/db/helpers/plan-limits";
import { isCloud } from "@/lib/config";
import { processInitialCrawlJob, processRecrawlJob } from "@/lib/crawl/process-job";

const RECRAWL_LOCK_ID = 73502;
const RECRAWL_SCHEDULE = process.env.RECRAWL_SCHEDULE ?? "0 */6 * * *";
const POLL_INTERVAL_MS = 2000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processLoop() {
  console.log("[worker] Job processing loop started");

  while (true) {
    try {
      await resetStaleJobs();

      const job = await claimNextJob();
      if (!job) {
        await sleep(POLL_INTERVAL_MS);
        continue;
      }

      console.log(`[worker] Processing ${job.type} job ${job.id} for org ${job.orgId}`);

      if (job.type === "initial") {
        await processInitialCrawlJob(job);
      } else if (job.type === "recrawl") {
        await processRecrawlJob(job);
      } else {
        console.error(`[worker] Unknown job type: ${job.type}`);
      }
    } catch (err) {
      console.error("[worker] Unexpected error in process loop:", err);
      await sleep(POLL_INTERVAL_MS);
    }
  }
}

async function enqueueRecrawls() {
  const locked = await tryAdvisoryLock(RECRAWL_LOCK_ID);
  if (!locked) {
    console.log("[worker] Skipping recrawl enqueue — another instance is running");
    return;
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

    let enqueued = 0;

    for (const { orgId } of orgs) {
      if (isCloud()) {
        const sub = await getOrgSubscription(orgId);
        if (!sub || !isActiveSubscription(sub.status)) continue;
      }

      const hasActive = await hasActiveRecrawlJob(orgId);
      if (hasActive) continue;

      await enqueueCrawlJob(orgId, "recrawl");
      enqueued++;
    }

    console.log(`[worker] Enqueued ${enqueued} recrawl jobs`);
  } catch (err) {
    console.error("[worker] Failed to enqueue recrawls:", err);
  } finally {
    await advisoryUnlock(RECRAWL_LOCK_ID);
  }
}

console.log(`[worker] Crawl worker started, recrawl schedule: ${RECRAWL_SCHEDULE}`);
processLoop();
cron.schedule(RECRAWL_SCHEDULE, enqueueRecrawls);
