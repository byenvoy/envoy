import { NextResponse } from "next/server";
import { withAuth, getActiveJobForOrg } from "@/lib/db/helpers";

export async function GET() {
  const auth = await withAuth();
  if (!auth.success) return auth.response;

  const job = await getActiveJobForOrg(auth.context.orgId);

  if (!job) {
    return NextResponse.json({ job: null });
  }

  return NextResponse.json({
    job: {
      id: job.id,
      type: job.type,
      status: job.status,
      totalPages: job.totalPages,
      pagesExtracted: job.pagesExtracted,
      pagesEmbedded: job.pagesEmbedded,
      error: job.error,
    },
  });
}
