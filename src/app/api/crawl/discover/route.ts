import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { discoverUrls, isSupportRelevant } from "@/lib/crawl/discover";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  // Update org domain
  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();

  if (profile) {
    const normalizedDomain = domain.replace(/^https?:\/\//, "").replace(/\/+$/, "");
    await supabase
      .from("organizations")
      .update({ domain: normalizedDomain })
      .eq("id", profile.org_id);
  }

  const urls = await discoverUrls(domain);
  const results = urls.map((url) => ({
    url,
    suggested: isSupportRelevant(url),
  }));

  return NextResponse.json({ urls: results });
}
