ALTER TABLE "knowledge_base_pages" ADD COLUMN "etag" text;--> statement-breakpoint
ALTER TABLE "knowledge_base_pages" ADD COLUMN "last_modified_header" text;--> statement-breakpoint
ALTER TABLE "knowledge_base_pages" ADD COLUMN "last_crawled_at" timestamp with time zone;