export interface Organization {
  id: string;
  name: string;
  domain: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  org_id: string;
  full_name: string | null;
  created_at: string;
}

export interface KnowledgeBasePage {
  id: string;
  org_id: string;
  url: string;
  title: string | null;
  markdown_content: string | null;
  content_hash: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeBaseChunk {
  id: string;
  page_id: string;
  org_id: string;
  chunk_index: number;
  content: string;
  token_count: number;
  embedding: number[] | null;
  created_at: string;
}
