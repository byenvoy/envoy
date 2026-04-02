import { NextRequest, NextResponse } from "next/server";
import { withAuth, getJobStatus } from "@/lib/db/helpers";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const auth = await withAuth();
  if (!auth.success) return auth.response;

  const job = await getJobStatus(jobId);

  if (!job || job.orgId !== auth.context.orgId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    status: job.status,
    totalPages: job.totalPages,
    pagesExtracted: job.pagesExtracted,
    pagesEmbedded: job.pagesEmbedded,
    failedUrls: job.failedUrls,
    error: job.error,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
  });
}
