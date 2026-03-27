CREATE INDEX IF NOT EXISTS knowledge_base_chunks_embedding_idx ON knowledge_base_chunks USING hnsw (embedding vector_cosine_ops);
