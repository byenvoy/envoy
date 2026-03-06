import type { SupabaseClient } from "@supabase/supabase-js";
import { embedText } from "./embeddings";
import { buildDraftPrompt } from "./prompt";
import { createLLMProvider } from "./llm";

interface MatchedChunk {
  id: string;
  page_id: string;
  chunk_index: number;
  content: string;
  token_count: number;
  similarity: number;
  source_url?: string;
}

interface RetrieveResult {
  draft: string;
  chunks: MatchedChunk[];
}

export async function retrieveAndDraft({
  supabase,
  orgId,
  companyName,
  customerMessage,
}: {
  supabase: SupabaseClient;
  orgId: string;
  companyName: string;
  customerMessage: string;
}): Promise<RetrieveResult> {
  // Embed the customer message
  const queryEmbedding = await embedText(customerMessage);

  // Vector search for relevant chunks
  const { data: matches, error } = await supabase.rpc("match_chunks", {
    query_embedding: JSON.stringify(queryEmbedding),
    filter_org_id: orgId,
    match_count: 3,
    similarity_threshold: 0.3,
  });

  if (error) throw error;

  const chunks: MatchedChunk[] = matches ?? [];

  // Fetch source URLs for matched chunks
  if (chunks.length > 0) {
    const pageIds = [...new Set(chunks.map((c) => c.page_id))];
    const { data: pages } = await supabase
      .from("knowledge_base_pages")
      .select("id, url")
      .in("id", pageIds);

    const pageUrlMap = new Map(
      (pages ?? []).map((p: { id: string; url: string }) => [p.id, p.url])
    );

    for (const chunk of chunks) {
      chunk.source_url = pageUrlMap.get(chunk.page_id);
    }
  }

  // Build prompt and generate draft
  const { system, user } = buildDraftPrompt({
    companyName,
    chunks: chunks.map((c) => ({
      content: c.content,
      sourceUrl: c.source_url,
    })),
    customerMessage,
  });

  const llm = createLLMProvider();
  const draft = await llm.generateDraft(system, user);

  return { draft, chunks };
}
