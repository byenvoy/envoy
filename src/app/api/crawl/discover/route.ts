import { NextResponse } from "next/server";
import { withAuth } from "@/lib/db/helpers";
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
  try {
    const url = new URL(
      domain.startsWith("http") ? domain : `https://${domain}`
    );
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

  const { urls, localeInfo } = await discoverUrls(domain);

  const results = urls.map((url) => ({
    url,
    suggested: isSupportRelevant(url),
  }));

  return NextResponse.json({
    urls: results,
    localeInfo,
  });
}
