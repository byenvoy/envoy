import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractPages } from "@/lib/crawl/extract";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const body = await request.json();
  const urls = body.urls as string[];

  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return NextResponse.json(
      { error: "URLs array is required" },
      { status: 400 }
    );
  }

  const extracted = await extractPages(urls);
  const results: { url: string; success: boolean; error?: string }[] = [];

  for (const page of extracted) {
    if (page.error || !page.markdown) {
      results.push({ url: page.url, success: false, error: page.error });
      continue;
    }

    const { error } = await supabase.from("knowledge_base_pages").upsert(
      {
        org_id: profile.org_id,
        url: page.url,
        title: page.title,
        markdown_content: page.markdown,
        content_hash: page.contentHash,
        is_active: true,
      },
      { onConflict: "org_id,url" }
    );

    if (error) {
      results.push({ url: page.url, success: false, error: error.message });
    } else {
      results.push({ url: page.url, success: true });
    }
  }

  return NextResponse.json({ results });
}
