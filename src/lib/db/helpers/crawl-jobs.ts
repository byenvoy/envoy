import { db } from "@/lib/db";
import { crawlJobs } from "@/lib/db/schema";
import { eq, and, sql, inArray } from "drizzle-orm";

export async function enqueueCrawlJob(
  orgId: string,
  type: "initial" | "recrawl",
  urls?: string[]
): Promise<string> {
  const [job] = await db
    .insert(crawlJobs)
    .values({
      orgId,
      type,
      urls: urls ?? null,
      totalPages: urls?.length ?? 0,
    })
    .returning({ id: crawlJobs.id });

  return job.id;
}

export async function claimNextJob() {
  const result = await db.execute(sql`
    UPDATE crawl_jobs SET status = 'running', started_at = now()
    WHERE id = (
      SELECT id FROM crawl_jobs
      WHERE status = 'pending'
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  `);

  const row = result[0] as {
    id: string;
    org_id: string;
    type: string;
    status: string;
    urls: string[] | null;
    total_pages: number;
    pages_extracted: number;
    pages_embedded: number;
    failed_urls: string[] | null;
    error: string | null;
    created_at: Date;
    started_at: Date | null;
    completed_at: Date | null;
  } | undefined;

  if (!row) return null;

  return {
    id: row.id,
    orgId: row.org_id,
    type: row.type as "initial" | "recrawl",
    status: row.status,
    urls: row.urls,
    totalPages: row.total_pages,
    pagesExtracted: row.pages_extracted,
    pagesEmbedded: row.pages_embedded,
    failedUrls: row.failed_urls,
    error: row.error,
    createdAt: row.created_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}

export async function updateJobProgress(
  jobId: string,
  update: {
    pagesExtracted?: number;
    pagesEmbedded?: number;
    totalPages?: number;
  }
) {
  const set: Record<string, unknown> = {};
  if (update.pagesExtracted !== undefined) {
    set.pagesExtracted = sql`${crawlJobs.pagesExtracted} + ${update.pagesExtracted}`;
  }
  if (update.pagesEmbedded !== undefined) {
    set.pagesEmbedded = sql`${crawlJobs.pagesEmbedded} + ${update.pagesEmbedded}`;
  }
  if (update.totalPages !== undefined) {
    set.totalPages = update.totalPages;
  }

  if (Object.keys(set).length === 0) return;

  await db.update(crawlJobs).set(set).where(eq(crawlJobs.id, jobId));
}

export async function completeJob(jobId: string, failedUrls?: string[]) {
  await db
    .update(crawlJobs)
    .set({
      status: "completed",
      failedUrls: failedUrls?.length ? failedUrls : null,
      completedAt: new Date(),
    })
    .where(eq(crawlJobs.id, jobId));
}

export async function failJob(jobId: string, error: string) {
  await db
    .update(crawlJobs)
    .set({
      status: "failed",
      error,
      completedAt: new Date(),
    })
    .where(eq(crawlJobs.id, jobId));
}

export async function getJobStatus(jobId: string) {
  const [job] = await db
    .select()
    .from(crawlJobs)
    .where(eq(crawlJobs.id, jobId));

  return job ?? null;
}

export async function getActiveJobForOrg(orgId: string) {
  const [job] = await db
    .select()
    .from(crawlJobs)
    .where(
      and(
        eq(crawlJobs.orgId, orgId),
        inArray(crawlJobs.status, ["pending", "running"])
      )
    )
    .orderBy(crawlJobs.createdAt)
    .limit(1);

  return job ?? null;
}

export async function resetStaleJobs() {
  await db.execute(sql`
    UPDATE crawl_jobs
    SET status = 'pending', started_at = NULL
    WHERE status = 'running'
    AND started_at < now() - interval '10 minutes'
  `);
}

export async function hasActiveRecrawlJob(orgId: string): Promise<boolean> {
  const [job] = await db
    .select({ id: crawlJobs.id })
    .from(crawlJobs)
    .where(
      and(
        eq(crawlJobs.orgId, orgId),
        eq(crawlJobs.type, "recrawl"),
        inArray(crawlJobs.status, ["pending", "running"])
      )
    )
    .limit(1);

  return !!job;
}
