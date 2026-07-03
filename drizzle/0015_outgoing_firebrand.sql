ALTER TABLE "conversations" ADD COLUMN "gmail_thread_id" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "is_automated" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "email_connections" ADD COLUMN "history_id" text;--> statement-breakpoint
ALTER TABLE "email_connections" ADD COLUMN "gmail_label_id" text;