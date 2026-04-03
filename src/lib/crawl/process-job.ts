import { db } from "@/lib/db";
import { knowledgeBasePages } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { updateJobProgress, completeJob, failJob } from "@/lib/db/helpers/crawl-jobs";
import { extractPages, type ExtractedPage } from "./extract";
import { checkPage } from "./check-page";
import { syncPageChunks } from "@/lib/rag/sync";
import { recrawlOrg } from "./recrawl";

interface CrawlJob {
  id: string;
  orgId: string;
  type: "initial" | "recrawl" | "resync";
  urls: string[] | null;
  totalPages: number;
}

export async function processInitialCrawlJob(job: CrawlJob) {
  if (!job.urls || job.urls.length === 0) {
    await completeJob(job.id);
    return;
  }

  const failedUrls: string[] = [];

  async function savePage(page: ExtractedPage): Promise<boolean> {
    if (page.error || !page.markdown) {
      return false;
    }

    try {
      const headers = await checkPage({ url: page.url });

      const [savedPage] = await db
        .insert(knowledgeBasePages)
        .values({
          orgId: job.orgId,
          url: page.url,
          title: page.title,
          markdownContent: page.markdown,
          contentHash: page.contentHash,
          etag: headers.etag,
          lastModifiedHeader: headers.lastModified,
          lastCrawledAt: new Date(),
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
            lastCrawledAt: new Date(),
            isActive: true,
            updatedAt: new Date(),
          },
        })
        .returning();

      await syncPageChunks(savedPage);
      return true;
    } catch (err) {
      console.error(`[job ${job.id}] Failed to save/embed ${page.url}:`, err);
      return false;
    }
  }

  try {
    // First pass
    await extractPages(job.urls, async (page) => {
      const ok = await savePage(page);
      if (ok) {
        await updateJobProgress(job.id, { pagesExtracted: 1, pagesEmbedded: 1 });
      } else {
        failedUrls.push(page.url);
        await updateJobProgress(job.id, { pagesExtracted: 1 });
      }
    });

    // Retry failed URLs once
    if (failedUrls.length > 0) {
      console.log(`[job ${job.id}] Retrying ${failedUrls.length} failed URLs`);
      const retryUrls = [...failedUrls];
      failedUrls.length = 0;

      await extractPages(retryUrls, async (page) => {
        const ok = await savePage(page);
        if (ok) {
          await updateJobProgress(job.id, { pagesEmbedded: 1 });
        } else {
          console.error(`[job ${job.id}] Retry failed for ${page.url}: ${page.error}`);
          failedUrls.push(page.url);
        }
      });
    }

    await completeJob(job.id, failedUrls);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[job ${job.id}] Initial crawl failed:`, message);
    await failJob(job.id, message);
  }
}

export async function processRecrawlJob(job: CrawlJob) {
  try {
    const result = await recrawlOrg(job.orgId, async (update) => {
      if (update.totalPages !== undefined) {
        await updateJobProgress(job.id, { totalPages: update.totalPages });
      }
      if (update.pagesChecked) {
        await updateJobProgress(job.id, { pagesExtracted: update.pagesChecked });
      }
      if (update.pagesUpdated) {
        await updateJobProgress(job.id, { pagesEmbedded: update.pagesUpdated });
      }
    });

    console.log(`[job ${job.id}] Recrawl complete:`, result);
    await completeJob(job.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[job ${job.id}] Recrawl failed:`, message);
    await failJob(job.id, message);
  }
}

export async function processResyncJob(job: CrawlJob) {
  const url = job.urls?.[0];
  if (!url) {
    await failJob(job.id, "No URL provided for resync job");
    return;
  }

  try {
    const page = await db
      .select()
      .from(knowledgeBasePages)
      .where(
        and(
          eq(knowledgeBasePages.orgId, job.orgId),
          eq(knowledgeBasePages.url, url)
        )
      )
      .then((r) => r[0]);

    if (!page) {
      await failJob(job.id, `Page not found for URL: ${url}`);
      return;
    }

    // Phase 1: cheap HTTP check with cached ETag/Last-Modified
    const check = await checkPage({
      url,
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
          lastCrawledAt: now,
        })
        .where(eq(knowledgeBasePages.id, page.id));

      console.log(`[job ${job.id}] Resync unchanged (HTTP headers) for ${url}`);
      await completeJob(job.id);
      return;
    }

    // Phase 2: full extraction
    const [extracted] = await extractPages([url]);

    if (extracted.error || !extracted.markdown) {
      await failJob(job.id, extracted.error ?? "Failed to extract page content");
      return;
    }

    // Phase 3: compare hash and sync if changed
    if (extracted.contentHash === page.contentHash) {
      await db
        .update(knowledgeBasePages)
        .set({
          etag: check.etag,
          lastModifiedHeader: check.lastModified,
          lastCrawledAt: now,
        })
        .where(eq(knowledgeBasePages.id, page.id));

      console.log(`[job ${job.id}] Resync unchanged (content hash) for ${url}`);
      await completeJob(job.id);
      return;
    }

    await db
      .update(knowledgeBasePages)
      .set({
        title: extracted.title || page.title,
        markdownContent: extracted.markdown,
        contentHash: extracted.contentHash,
        etag: check.etag,
        lastModifiedHeader: check.lastModified,
        lastCrawledAt: now,
        updatedAt: now,
      })
      .where(eq(knowledgeBasePages.id, page.id));

    await syncPageChunks({
      id: page.id,
      orgId: page.orgId,
      markdownContent: extracted.markdown,
      contentHash: extracted.contentHash,
    });

    console.log(`[job ${job.id}] Resync complete for ${url}`);
    await completeJob(job.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[job ${job.id}] Resync failed:`, message);
    await failJob(job.id, message);
  }
}
