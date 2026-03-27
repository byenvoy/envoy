import { db } from "@/lib/db";
import { knowledgeBasePages, knowledgeBaseChunks } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { chunkText } from "./chunker";
import { embedTexts } from "./embeddings";

interface SyncPage {
  id: string;
  orgId: string;
  markdownContent: string | null;
  contentHash: string | null;
}

export async function syncPageChunks(
  page: SyncPage
): Promise<number> {
  if (!page.markdownContent) return 0;

  // Delete existing chunks for this page
  await db
    .delete(knowledgeBaseChunks)
    .where(eq(knowledgeBaseChunks.pageId, page.id));

  // Chunk the content
  const chunks = chunkText(page.markdownContent);
  if (chunks.length === 0) return 0;

  // Generate embeddings for all chunks
  const embeddings = await embedTexts(chunks.map((c) => c.content));

  // Insert chunks with embeddings
  const rows = chunks.map((chunk, i) => ({
    pageId: page.id,
    orgId: page.orgId,
    chunkIndex: i,
    content: chunk.content,
    tokenCount: chunk.tokenCount,
    embedding: JSON.stringify(embeddings[i]),
    contentHash: page.contentHash,
  }));

  await db.insert(knowledgeBaseChunks).values(rows);

  return chunks.length;
}

export async function syncAllPages(
  orgId: string
): Promise<{ pagesProcessed: number; chunksCreated: number }> {
  // Get all active pages for the org
  const pages = await db
    .select()
    .from(knowledgeBasePages)
    .where(
      and(
        eq(knowledgeBasePages.orgId, orgId),
        eq(knowledgeBasePages.isActive, true)
      )
    );

  if (pages.length === 0) {
    return { pagesProcessed: 0, chunksCreated: 0 };
  }

  // Find pages that already have chunks, with the content_hash they were generated from
  const existingChunks = await db
    .select({
      pageId: knowledgeBaseChunks.pageId,
      contentHash: knowledgeBaseChunks.contentHash,
    })
    .from(knowledgeBaseChunks)
    .where(eq(knowledgeBaseChunks.orgId, orgId));

  const chunkedPageHashes = new Map<string, string | null>();
  for (const c of existingChunks) {
    chunkedPageHashes.set(c.pageId, c.contentHash);
  }

  // Process pages that have no chunks or whose content has changed
  const pagesToProcess = pages.filter((p) => {
    const existingHash = chunkedPageHashes.get(p.id);
    if (existingHash === undefined) return true; // no chunks yet
    return existingHash !== p.contentHash; // content changed
  });

  let totalChunks = 0;
  for (const page of pagesToProcess) {
    const count = await syncPageChunks(page);
    totalChunks += count;
  }

  return { pagesProcessed: pagesToProcess.length, chunksCreated: totalChunks };
}
