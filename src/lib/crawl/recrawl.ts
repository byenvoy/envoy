import { db } from "@/lib/db";
import { knowledgeBasePages } from "@/lib/db/schema";
import { eq, and, inArray, isNotNull, sql } from "drizzle-orm";
import { checkPage } from "./check-page";
import { extractPages, type ExtractedPage } from "./extract";
import { syncPageChunks } from "@/lib/rag/sync";
import { getOrgSubscription, isActiveSubscription } from "@/lib/db/helpers/plan-limits";
import { isCloud } from "@/lib/config";

export interface RecrawlOrgResult {
  pagesChecked: number;
  pagesUpdated: number;
  pagesSkipped: number;
  errors: number;
}

export interface RecrawlAllResult {
  orgsProcessed: number;
  pagesChecked: number;
  pagesUpdated: number;
  errors: number;
}

export interface RecrawlProgressUpdate {
  totalPages?: number;
  pagesChecked?: number;
  pagesUpdated?: number;
}

export async function recrawlOrg(
  orgId: string,
  onProgress?: (update: RecrawlProgressUpdate) => Promise<void>
): Promise<RecrawlOrgResult> {
  const result: RecrawlOrgResult = {
    pagesChecked: 0,
    pagesUpdated: 0,
    pagesSkipped: 0,
    errors: 0,
  };

  const pages = await db
    .select()
    .from(knowledgeBasePages)
    .where(
      and(
        eq(knowledgeBasePages.orgId, orgId),
        eq(knowledgeBasePages.isActive, true),
        isNotNull(knowledgeBasePages.url),
        inArray(knowledgeBasePages.source, ["crawled", "url"])
      )
    );

  if (pages.length === 0) return result;

  if (onProgress) await onProgress({ totalPages: pages.length });

  // Phase 1: cheap HTTP checks to find which pages may have changed
  const possiblyChanged: Array<{
    page: typeof pages[number];
    etag: string | null;
    lastModified: string | null;
  }> = [];

  for (const page of pages) {
    result.pagesChecked++;

    try {
      const check = await checkPage({
        url: page.url!,
        etag: page.etag,
        lastModified: page.lastModifiedHeader,
      });

      if (!check.changed) {
        result.pagesSkipped++;
        await db
          .update(knowledgeBasePages)
          .set({
            etag: check.etag,
            lastModifiedHeader: check.lastModified,
            lastCrawledAt: new Date(),
          })
          .where(eq(knowledgeBasePages.id, page.id));
        if (onProgress) await onProgress({ pagesChecked: 1 });
        continue;
      }

      possiblyChanged.push({
        page,
        etag: check.etag,
        lastModified: check.lastModified,
      });
    } catch (err) {
      console.error(`Check failed for ${page.url}:`, err);
      result.errors++;
    }
  }

  if (possiblyChanged.length === 0) return result;

  // Phase 2: Puppeteer extraction for pages that may have changed
  const urlsToExtract = possiblyChanged.map((p) => p.page.url!);
  let extracted: ExtractedPage[];

  try {
    extracted = await extractPages(urlsToExtract);
  } catch (err) {
    console.error(`Puppeteer extraction failed for org ${orgId}:`, err);
    result.errors += possiblyChanged.length;
    return result;
  }

  // Phase 3: compare hashes and sync changed pages
  for (let i = 0; i < possiblyChanged.length; i++) {
    const { page, etag, lastModified } = possiblyChanged[i];
    const ext = extracted[i];
    const now = new Date();

    try {
      if (ext.error || !ext.markdown) {
        console.error(`Extract error for ${page.url}: ${ext.error}`);
        result.errors++;
        if (onProgress) await onProgress({ pagesChecked: 1 });
        continue;
      }

      if (ext.contentHash === page.contentHash) {
        result.pagesSkipped++;
        await db
          .update(knowledgeBasePages)
          .set({
            etag,
            lastModifiedHeader: lastModified,
            lastCrawledAt: now,
          })
          .where(eq(knowledgeBasePages.id, page.id));
        if (onProgress) await onProgress({ pagesChecked: 1 });
        continue;
      }

      // Content actually changed — update page and re-sync chunks
      await db
        .update(knowledgeBasePages)
        .set({
          title: ext.title || page.title,
          markdownContent: ext.markdown,
          contentHash: ext.contentHash,
          etag,
          lastModifiedHeader: lastModified,
          lastCrawledAt: now,
          updatedAt: now,
        })
        .where(eq(knowledgeBasePages.id, page.id));

      await syncPageChunks({
        id: page.id,
        orgId: page.orgId,
        markdownContent: ext.markdown,
        contentHash: ext.contentHash,
      });

      result.pagesUpdated++;
      if (onProgress) await onProgress({ pagesChecked: 1, pagesUpdated: 1 });
    } catch (err) {
      console.error(`Sync failed for ${page.url}:`, err);
      result.errors++;
    }
  }

  return result;
}

export async function recrawlAllOrgs(): Promise<RecrawlAllResult> {
  const result: RecrawlAllResult = {
    orgsProcessed: 0,
    pagesChecked: 0,
    pagesUpdated: 0,
    errors: 0,
  };

  // Find orgs that have recrawlable pages
  const orgs = await db
    .selectDistinct({ orgId: knowledgeBasePages.orgId })
    .from(knowledgeBasePages)
    .where(
      and(
        eq(knowledgeBasePages.isActive, true),
        isNotNull(knowledgeBasePages.url),
        inArray(knowledgeBasePages.source, ["crawled", "url"])
      )
    );

  for (const { orgId } of orgs) {
    try {
      if (isCloud()) {
        const sub = await getOrgSubscription(orgId);
        if (!sub || !isActiveSubscription(sub.status)) continue;
      }

      const orgResult = await recrawlOrg(orgId);
      result.orgsProcessed++;
      result.pagesChecked += orgResult.pagesChecked;
      result.pagesUpdated += orgResult.pagesUpdated;
      result.errors += orgResult.errors;
    } catch (err) {
      console.error(`Recrawl failed for org ${orgId}:`, err);
      result.errors++;
    }
  }

  return result;
}
