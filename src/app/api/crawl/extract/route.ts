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

  const results: { url: string; success: boolean; error?: string }[] = [];

  console.log(`[extract] Starting extraction of ${urls.length} URLs for org ${profile.org_id}`);

  // Process URLs and save each page to DB immediately after extraction
  // so progress can be observed by polling the knowledge_base_pages table.
  await extractPages(urls, async (page) => {
    console.log(`[extract] Page result: ${page.url} - ${page.error ?? 'ok'} - content length: ${page.markdown?.length ?? 0}`);
    if (page.error || !page.markdown) {
      results.push({ url: page.url, success: false, error: page.error });
      return;
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
  });

  console.log(`[extract] Finished. Results:`, JSON.stringify(results.map(r => ({ url: r.url, success: r.success, error: r.error }))));
  return NextResponse.json({ results });
}
