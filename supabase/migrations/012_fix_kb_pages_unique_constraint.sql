-- Drop the partial unique index that breaks ON CONFLICT upserts
DROP INDEX IF EXISTS knowledge_base_pages_org_url;

-- Create a proper unique constraint (NULLs are unique by default in Postgres,
-- so manual entries with url=NULL won't conflict with each other)
ALTER TABLE knowledge_base_pages
  ADD CONSTRAINT knowledge_base_pages_org_url_unique UNIQUE (org_id, url);
