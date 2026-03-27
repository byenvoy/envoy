import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { knowledgeBasePages } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/db/helpers";
import { syncPageChunks } from "@/lib/rag/sync";
import type { KnowledgeBasePage } from "@/lib/types/database";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await withAuth();
  if (!auth.success) return auth.response;
  const { orgId } = auth.context;

  const page = await db
    .select()
    .from(knowledgeBasePages)
    .where(
      and(
        eq(knowledgeBasePages.id, id),
        eq(knowledgeBasePages.orgId, orgId)
      )
    )
    .then((r) => r[0]);

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

    await db
      .update(knowledgeBasePages)
      .set({
        title: article.title || page.title,
        markdownContent: markdown,
        updatedAt: new Date(),
      })
      .where(eq(knowledgeBasePages.id, id));

    const updatedPage = {
      ...page,
      title: article.title || page.title,
      markdownContent: markdown,
    };

    const chunks = await syncPageChunks(updatedPage);

    return NextResponse.json({ ok: true, chunks });
  } catch (err) {
    console.error("Resync failed:", err);
    return NextResponse.json(
      { error: "Failed to re-sync page" },
      { status: 500 }
    );
  }
}
