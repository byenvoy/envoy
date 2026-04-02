import { db } from "@/lib/db";
import { knowledgeBasePages } from "@/lib/db/schema";
import { updateJobProgress, completeJob, failJob } from "@/lib/db/helpers/crawl-jobs";
import { extractPages, type ExtractedPage } from "./extract";
import { checkPage } from "./check-page";
import { syncPageChunks } from "@/lib/rag/sync";
import { recrawlOrg } from "./recrawl";

interface CrawlJob {
  id: string;
  orgId: string;
  type: "initial" | "recrawl";
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
