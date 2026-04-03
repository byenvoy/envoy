import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { crawlJobs } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { withAuth } from "@/lib/db/helpers";

export async function GET() {
  const auth = await withAuth();
  if (!auth.success) return auth.response;

  const jobs = await db
    .select()
    .from(crawlJobs)
    .where(
      and(
        eq(crawlJobs.orgId, auth.context.orgId),
        inArray(crawlJobs.status, ["pending", "running"])
      )
    )
    .orderBy(crawlJobs.createdAt);

  return NextResponse.json({
    jobs: jobs.map((job) => ({
      id: job.id,
      type: job.type,
      status: job.status,
      urls: job.urls,
      totalPages: job.totalPages,
      pagesExtracted: job.pagesExtracted,
      pagesEmbedded: job.pagesEmbedded,
      error: job.error,
    })),
  });
}
