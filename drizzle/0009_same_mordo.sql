ALTER TABLE "organizations" ADD COLUMN "greeting_template" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "sign_off" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "llm_error_message" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "llm_error_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "sent_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "knowledge_base_pages" ADD CONSTRAINT "knowledge_base_pages_source_check" CHECK ("knowledge_base_pages"."source" IN ('crawled', 'manual', 'url', 'upload', 'notion', 'confluence'));