import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { knowledgeBasePages } from "@/lib/db/schema";
import { withAuth } from "@/lib/db/helpers";
import { extractPages } from "@/lib/crawl/extract";
import { checkPage } from "@/lib/crawl/check-page";

export async function POST(request: Request) {
  const auth = await withAuth();
  if (!auth.success) return auth.response;
  const { orgId } = auth.context;

  const body = await request.json();
  const urls = body.urls as string[];

  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return NextResponse.json(
      { error: "URLs array is required" },
      { status: 400 }
    );
  }

  const results: { url: string; success: boolean; error?: string }[] = [];

  console.log(`[extract] Starting extraction of ${urls.length} URLs for org ${orgId}`);

  // Process URLs and save each page to DB immediately after extraction
  // so progress can be observed by polling the knowledge_base_pages table.
  await extractPages(urls, async (page) => {
    console.log(`[extract] Page result: ${page.url} - ${page.error ?? 'ok'} - content length: ${page.markdown?.length ?? 0}`);
    if (page.error || !page.markdown) {
      results.push({ url: page.url, success: false, error: page.error });
      return;
    }

    try {
      // Capture ETag/Last-Modified headers for future recrawl optimization
      const headers = await checkPage({ url: page.url });

      await db
        .insert(knowledgeBasePages)
        .values({
          orgId,
          url: page.url,
          title: page.title,
          markdownContent: page.markdown,
          contentHash: page.contentHash,
          etag: headers.etag,
          lastModifiedHeader: headers.lastModified,
          isActive: true,
        })
        .onConflictDoUpdate({
          target: [knowledgeBasePages.orgId, knowledgeBasePages.url],
          set: {
            title: page.title,
            markdownContent: page.markdown,
            contentHash: page.contentHash,
            etag: headers.etag,
            lastModifiedHeader: headers.lastModified,
            isActive: true,
            updatedAt: new Date(),
          },
        });

      results.push({ url: page.url, success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      results.push({ url: page.url, success: false, error: message });
    }
  });

  console.log(`[extract] Finished. Results:`, JSON.stringify(results.map(r => ({ url: r.url, success: r.success, error: r.error }))));
  return NextResponse.json({ results });
}
