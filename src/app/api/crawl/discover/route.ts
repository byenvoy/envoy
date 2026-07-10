import { NextResponse } from "next/server";
import { withAuth, enqueueCrawlJob } from "@/lib/db/helpers";
import {
  discoverUrls,
  isSupportRelevant,
} from "@/lib/crawl/discover";

export async function POST(request: Request) {
  const auth = await withAuth();
  if (!auth.success) return auth.response;
  const { orgId } = auth.context;

  const body = await request.json();
  const domain = body.domain as string;

  if (!domain) {
    return NextResponse.json({ error: "Domain is required" }, { status: 400 });
  }

  // Validate URL - reject localhost/private IPs
  const normalized = domain.startsWith("http") ? domain : `https://${domain}`;
  try {
    const url = new URL(normalized);
    if (
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname.startsWith("192.168.") ||
      url.hostname.startsWith("10.") ||
      url.hostname.startsWith("172.")
    ) {
      return NextResponse.json(
        { error: "Private/localhost URLs are not allowed" },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  const outcome = await discoverUrls(domain);

  if (outcome.status === "blocked") {
    // Bot protection walled off the fetch tier. Queue the Puppeteer worker job
    // as a best-effort attempt, tagged with the reason so the client can surface
    // the cooperative path if the browser tier also comes up empty.
    const jobId = await enqueueCrawlJob(
      orgId,
      "discover",
      [normalized],
      outcome.reason
    );
    return NextResponse.json({
      status: "blocked",
      reason: outcome.reason,
      jobId,
      urls: [],
    });
  }

  if (outcome.status === "empty") {
    return NextResponse.json({ status: "empty", urls: [] });
  }

  const results = outcome.urls.map((url) => ({
    url,
    suggested: isSupportRelevant(url),
  }));

  return NextResponse.json({
    status: "ok",
    urls: results,
    localeInfo: outcome.localeInfo,
  });
}
