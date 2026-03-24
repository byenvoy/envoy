import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractPages } from "@/lib/crawl/extract";
import { syncPageChunks } from "@/lib/rag/sync";
import type { KnowledgeBasePage } from "@/lib/types/database";

export async function POST(request: NextRequest) {
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

  const { url } = await request.json();
  if (!url || typeof url !== "string") {
    return NextResponse.json(
      { error: "URL is required" },
      { status: 400 }
    );
  }

  // Validate URL format
  try {
    new URL(url);
  } catch {
    return NextResponse.json(
      { error: "Invalid URL format" },
      { status: 400 }
    );
  }

  const [extracted] = await extractPages([url]);

  if (extracted.error || !extracted.markdown) {
    return NextResponse.json(
      { error: extracted.error ?? "Could not extract content from URL" },
      { status: 422 }
    );
  }

  const admin = createAdminClient();

  const { data: page, error } = await admin
    .from("knowledge_base_pages")
    .upsert(
      {
        org_id: profile.org_id,
        url: extracted.url,
        title: extracted.title,
        markdown_content: extracted.markdown,
        content_hash: extracted.contentHash,
        source: "url",
        is_active: true,
      },
      { onConflict: "org_id,url" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await syncPageChunks(admin, page as KnowledgeBasePage);

  return NextResponse.json({ page });
}
