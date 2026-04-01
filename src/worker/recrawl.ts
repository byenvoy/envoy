import cron from "node-cron";
import { recrawlAllOrgs } from "@/lib/crawl/recrawl";
import { tryAdvisoryLock, advisoryUnlock } from "@/lib/db/helpers";

const RECRAWL_LOCK_ID = 73502;
const SCHEDULE = process.env.RECRAWL_SCHEDULE ?? "0 */6 * * *"; // every 6 hours

async function run() {
  const locked = await tryAdvisoryLock(RECRAWL_LOCK_ID);
  if (!locked) {
    console.log("[recrawl] Skipping — another instance is running");
    return;
  }

  try {
    console.log("[recrawl] Starting recrawl...");
    const result = await recrawlAllOrgs();
    console.log("[recrawl] Complete:", result);
  } catch (err) {
    console.error("[recrawl] Failed:", err);
  } finally {
    await advisoryUnlock(RECRAWL_LOCK_ID);
  }
}

console.log(`[recrawl] Worker started, schedule: ${SCHEDULE}`);
cron.schedule(SCHEDULE, run);
