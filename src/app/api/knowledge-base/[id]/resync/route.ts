import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { knowledgeBasePages, crawlJobs } from "@/lib/db/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import { withAuth, enqueueCrawlJob } from "@/lib/db/helpers";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await withAuth();
  if (!auth.success) return auth.response;
  const { orgId } = auth.context;

  const page = await db
    .select()
    .from(knowledgeBasePages)
    .where(
      and(
        eq(knowledgeBasePages.id, id),
        eq(knowledgeBasePages.orgId, orgId)
      )
    )
    .then((r) => r[0]);

  if (!page) {
    return NextResponse.json({ error: "Page not found" }, { status: 404 });
  }

  if (!page.url || !["crawled", "url"].includes(page.source)) {
    return NextResponse.json(
      { error: "Only URL-based pages can be re-synced" },
      { status: 400 }
    );
  }

  // Check for existing active resync job for this specific URL
  const [existingJob] = await db
    .select({ id: crawlJobs.id })
    .from(crawlJobs)
    .where(
      and(
        eq(crawlJobs.orgId, orgId),
        eq(crawlJobs.type, "resync"),
        inArray(crawlJobs.status, ["pending", "running"]),
        sql`${crawlJobs.urls} @> ARRAY[${page.url}]`
      )
    )
    .limit(1);

  if (existingJob) {
    return NextResponse.json({ jobId: existingJob.id });
  }

  const jobId = await enqueueCrawlJob(orgId, "resync", [page.url]);
  return NextResponse.json({ jobId });
}
