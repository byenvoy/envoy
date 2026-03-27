import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export interface MatchedChunk {
  id: string;
  page_id: string;
  chunk_index: number;
  content: string;
  token_count: number;
  similarity: number;
}

/**
 * Vector similarity search using pgvector's cosine distance operator.
 * Replaces the Supabase `match_chunks` RPC function.
 *
 * Uses the HNSW index on knowledge_base_chunks.embedding for fast
 * approximate nearest neighbor search.
 */
export async function matchChunks({
  queryEmbedding,
  orgId,
  matchCount = 5,
  similarityThreshold = 0.3,
}: {
  queryEmbedding: number[];
  orgId: string;
  matchCount?: number;
  similarityThreshold?: number;
}): Promise<MatchedChunk[]> {
  const embeddingStr = `[${queryEmbedding.join(",")}]`;

  const results = await db.execute(sql`
    SELECT
      c.id,
      c.page_id,
      c.chunk_index,
      c.content,
      c.token_count,
      1 - (c.embedding <=> ${embeddingStr}::vector) AS similarity
    FROM knowledge_base_chunks c
    WHERE c.org_id = ${orgId}
      AND c.embedding IS NOT NULL
      AND 1 - (c.embedding <=> ${embeddingStr}::vector) > ${similarityThreshold}
    ORDER BY c.embedding <=> ${embeddingStr}::vector
    LIMIT ${matchCount}
  `);

  return results as unknown as MatchedChunk[];
}
