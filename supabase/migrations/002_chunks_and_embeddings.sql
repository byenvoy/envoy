-- Knowledge base chunks with embeddings
create table knowledge_base_chunks (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references knowledge_base_pages on delete cascade,
  org_id uuid not null references organizations on delete cascade,
  chunk_index integer not null,
  content text not null,
  token_count integer not null,
  embedding vector(1536),
  created_at timestamptz not null default now()
);

-- HNSW index for cosine similarity search
create index knowledge_base_chunks_embedding_idx
  on knowledge_base_chunks
  using hnsw (embedding vector_cosine_ops);

-- Index for syncing (delete chunks when page is re-processed)
create index knowledge_base_chunks_page_id_idx
  on knowledge_base_chunks (page_id);

-- Index for retrieval scoped to org
create index knowledge_base_chunks_org_id_idx
  on knowledge_base_chunks (org_id);

alter table knowledge_base_chunks enable row level security;

-- RLS policies
create policy "Users can view their org chunks"
  on knowledge_base_chunks for select
  using (org_id = get_user_org_id());

create policy "Users can insert chunks for their org"
  on knowledge_base_chunks for insert
  with check (org_id = get_user_org_id());

create policy "Users can delete their org chunks"
  on knowledge_base_chunks for delete
  using (org_id = get_user_org_id());

-- RPC function for vector similarity search
create or replace function match_chunks(
  query_embedding vector(1536),
  filter_org_id uuid,
  match_count integer default 5,
  similarity_threshold double precision default 0.3
)
returns table (
  id uuid,
  page_id uuid,
  chunk_index integer,
  content text,
  token_count integer,
  similarity double precision
)
language plpgsql
security definer
set search_path = 'public', 'extensions'
as $$
begin
  return query
    select
      c.id,
      c.page_id,
      c.chunk_index,
      c.content,
      c.token_count,
      1 - (c.embedding <=> query_embedding) as similarity
    from public.knowledge_base_chunks c
    where c.org_id = filter_org_id
      and c.embedding is not null
      and 1 - (c.embedding <=> query_embedding) > similarity_threshold
    order by c.embedding <=> query_embedding
    limit match_count;
end;
$$;
