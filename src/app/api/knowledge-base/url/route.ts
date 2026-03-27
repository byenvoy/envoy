import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { knowledgeBasePages } from "@/lib/db/schema";
import { withAuth } from "@/lib/db/helpers";
import { extractPages } from "@/lib/crawl/extract";
import { syncPageChunks } from "@/lib/rag/sync";
import type { KnowledgeBasePage } from "@/lib/types/database";

export async function POST(request: NextRequest) {
  const auth = await withAuth();
  if (!auth.success) return auth.response;
  const { orgId } = auth.context;

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

  try {
    const page = await db
      .insert(knowledgeBasePages)
      .values({
        orgId,
        url: extracted.url,
        title: extracted.title,
        markdownContent: extracted.markdown,
        contentHash: extracted.contentHash,
        source: "url",
        isActive: true,
      })
      .onConflictDoUpdate({
        target: [knowledgeBasePages.orgId, knowledgeBasePages.url],
        set: {
          title: extracted.title,
          markdownContent: extracted.markdown,
          contentHash: extracted.contentHash,
          isActive: true,
          updatedAt: new Date(),
        },
      })
      .returning()
      .then((r) => r[0]);

    await syncPageChunks(page as unknown as KnowledgeBasePage);

    return NextResponse.json({ page });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
