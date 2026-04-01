import { NextRequest, NextResponse } from "next/server";
import { tryAdvisoryLock, advisoryUnlock } from "@/lib/db/helpers";
import { recrawlAllOrgs } from "@/lib/crawl/recrawl";

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
      { error: "Recrawl already in progress" },
      { status: 409 }
    );
  }

  try {
    const result = await recrawlAllOrgs();
    return NextResponse.json(result);
  } finally {
    await advisoryUnlock(73502);
  }
}
