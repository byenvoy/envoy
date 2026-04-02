import { NextResponse } from "next/server";
import { withAuth, enqueueCrawlJob } from "@/lib/db/helpers";

export async function POST(request: Request) {
  const auth = await withAuth();
  if (!auth.success) return auth.response;
  const { orgId } = auth.context;

  const body = await request.json();
  const urls = body.urls as string[];

  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return NextResponse.json(
      { error: "URLs array is required" },
      { status: 400 }
    );
  }

  const jobId = await enqueueCrawlJob(orgId, "initial", urls);

  return NextResponse.json({ jobId });
}
