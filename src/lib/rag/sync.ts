import type { SupabaseClient } from "@supabase/supabase-js";
import type { KnowledgeBasePage } from "@/lib/types/database";
import { chunkText } from "./chunker";
import { embedTexts } from "./embeddings";

export async function syncPageChunks(
  adminClient: SupabaseClient,
  page: KnowledgeBasePage
): Promise<number> {
  if (!page.markdown_content) return 0;

  // Delete existing chunks for this page
  await adminClient
    .from("knowledge_base_chunks")
    .delete()
    .eq("page_id", page.id);

  // Chunk the content
  const chunks = chunkText(page.markdown_content);
  if (chunks.length === 0) return 0;

  // Generate embeddings for all chunks
  const embeddings = await embedTexts(chunks.map((c) => c.content));

  // Insert chunks with embeddings
  const rows = chunks.map((chunk, i) => ({
    page_id: page.id,
    org_id: page.org_id,
    chunk_index: i,
    content: chunk.content,
    token_count: chunk.tokenCount,
    embedding: JSON.stringify(embeddings[i]),
  }));

  const { error } = await adminClient
    .from("knowledge_base_chunks")
    .insert(rows);

  if (error) throw error;

  return chunks.length;
}

export async function syncAllPages(
  adminClient: SupabaseClient,
  orgId: string
): Promise<{ pagesProcessed: number; chunksCreated: number }> {
  // Get all active pages for the org
  const { data: pages, error: pagesError } = await adminClient
    .from("knowledge_base_pages")
    .select("*")
    .eq("org_id", orgId)
    .eq("is_active", true);

  if (pagesError) throw pagesError;
  if (!pages || pages.length === 0) {
    return { pagesProcessed: 0, chunksCreated: 0 };
  }

  // Find pages that already have chunks
  const { data: existingChunks } = await adminClient
    .from("knowledge_base_chunks")
    .select("page_id")
    .eq("org_id", orgId);

  const pagesWithChunks = new Set(
    (existingChunks ?? []).map((c: { page_id: string }) => c.page_id)
  );

  // Only process pages without chunks
  const pagesToProcess = pages.filter(
    (p: KnowledgeBasePage) => !pagesWithChunks.has(p.id)
  );

  let totalChunks = 0;
  for (const page of pagesToProcess) {
    const count = await syncPageChunks(adminClient, page as KnowledgeBasePage);
    totalChunks += count;
  }

  return { pagesProcessed: pagesToProcess.length, chunksCreated: totalChunks };
}
