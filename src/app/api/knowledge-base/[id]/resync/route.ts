import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncPageChunks } from "@/lib/rag/sync";
import type { KnowledgeBasePage } from "@/lib/types/database";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

  const admin = createAdminClient();

  const { data: page } = await admin
    .from("knowledge_base_pages")
    .select("*")
    .eq("id", id)
    .eq("org_id", profile.org_id)
    .single();

  if (!page) {
    return NextResponse.json({ error: "Page not found" }, { status: 404 });
  }

  if (page.source !== "crawled" || !page.url) {
    return NextResponse.json(
      { error: "Only crawled pages can be re-synced" },
      { status: 400 }
    );
  }

  // Re-fetch the page content
  try {
    const { Readability } = await import("@mozilla/readability");
    const { JSDOM } = await import("jsdom");
    const TurndownService = (await import("turndown")).default;

    const res = await fetch(page.url);
    const html = await res.text();

    const dom = new JSDOM(html, { url: page.url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (!article) {
      return NextResponse.json(
        { error: "Failed to parse page content" },
        { status: 422 }
      );
    }

    const turndown = new TurndownService();
    const markdown = turndown.turndown(article.content ?? "");

    await admin
      .from("knowledge_base_pages")
      .update({
        title: article.title || page.title,
        markdown_content: markdown,
      })
      .eq("id", id);

    const updatedPage = {
      ...page,
      title: article.title || page.title,
      markdown_content: markdown,
    };

    const chunks = await syncPageChunks(
      admin,
      updatedPage as KnowledgeBasePage
    );

    return NextResponse.json({ ok: true, chunks });
  } catch (err) {
    console.error("Resync failed:", err);
    return NextResponse.json(
      { error: "Failed to re-sync page" },
      { status: 500 }
    );
  }
}
