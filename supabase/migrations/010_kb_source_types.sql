-- Expand knowledge_base_pages source types to support single URL, file upload, and future integrations
alter table knowledge_base_pages
  drop constraint if exists knowledge_base_pages_source_check;

alter table knowledge_base_pages
  add constraint knowledge_base_pages_source_check
    check (source in ('crawled', 'manual', 'url', 'upload', 'notion', 'confluence'));
