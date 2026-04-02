import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { knowledgeBasePages } from "@/lib/db/schema";
import { withAuth } from "@/lib/db/helpers";
import { extractPages } from "@/lib/crawl/extract";
import { checkPage } from "@/lib/crawl/check-page";
import { syncPageChunks } from "@/lib/rag/sync";

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
    // Capture ETag/Last-Modified headers for future recrawl optimization
    const headers = await checkPage({ url: extracted.url });

    const page = await db
      .insert(knowledgeBasePages)
      .values({
        orgId,
        url: extracted.url,
        title: extracted.title,
        markdownContent: extracted.markdown,
        contentHash: extracted.contentHash,
        etag: headers.etag,
        lastModifiedHeader: headers.lastModified,
        lastCrawledAt: new Date(),
        source: "url",
        isActive: true,
      })
      .onConflictDoUpdate({
        target: [knowledgeBasePages.orgId, knowledgeBasePages.url],
        set: {
          title: extracted.title,
          markdownContent: extracted.markdown,
          contentHash: extracted.contentHash,
          etag: headers.etag,
          lastModifiedHeader: headers.lastModified,
          lastCrawledAt: new Date(),
          isActive: true,
          updatedAt: new Date(),
        },
      })
      .returning()
      .then((r) => r[0]);

    await syncPageChunks(page);

    return NextResponse.json({ page });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
