import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { knowledgeBasePages } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/db/helpers";
import { syncPageChunks } from "@/lib/rag/sync";
import { checkPage } from "@/lib/crawl/check-page";
import { extractPages } from "@/lib/crawl/extract";

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

  if (!page.url || !["crawled", "url"].includes(page.source)) {
    return NextResponse.json(
      { error: "Only URL-based pages can be re-synced" },
      { status: 400 }
    );
  }

  try {
    // Phase 1: cheap HTTP check with cached ETag/Last-Modified
    const check = await checkPage({
      url: page.url,
      etag: page.etag,
      lastModified: page.lastModifiedHeader,
    });

    const now = new Date();

    if (!check.changed) {
      await db
        .update(knowledgeBasePages)
        .set({
          etag: check.etag,
          lastModifiedHeader: check.lastModified,
          lastRecrawledAt: now,
        })
        .where(eq(knowledgeBasePages.id, id));

      return NextResponse.json({ ok: true, unchanged: true });
    }

    // Phase 2: full Puppeteer extraction (consistent with initial crawl)
    const [extracted] = await extractPages([page.url]);

    if (extracted.error || !extracted.markdown) {
      return NextResponse.json(
        { error: extracted.error ?? "Failed to extract page content" },
        { status: 422 }
      );
    }

    // Phase 3: compare hash and sync if changed
    if (extracted.contentHash === page.contentHash) {
      await db
        .update(knowledgeBasePages)
        .set({
          etag: check.etag,
          lastModifiedHeader: check.lastModified,
          lastRecrawledAt: now,
        })
        .where(eq(knowledgeBasePages.id, id));

      return NextResponse.json({ ok: true, unchanged: true });
    }

    await db
      .update(knowledgeBasePages)
      .set({
        title: extracted.title || page.title,
        markdownContent: extracted.markdown,
        contentHash: extracted.contentHash,
        etag: check.etag,
        lastModifiedHeader: check.lastModified,
        lastRecrawledAt: now,
        updatedAt: now,
      })
      .where(eq(knowledgeBasePages.id, id));

    const updatedPage = {
      ...page,
      title: extracted.title || page.title,
      markdownContent: extracted.markdown,
      contentHash: extracted.contentHash,
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
