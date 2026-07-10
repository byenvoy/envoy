-- The original messages_source_check (0002) predates the Gmail REST
-- transport, so it only allowed ('imap', 'smtp', 'manual'). The poll now
-- writes source = 'gmail' for Gmail-ingested and Gmail-sent messages, which
-- failed the check constraint (23514) and crashed every poll before draft
-- generation. Widen the constraint to include 'gmail'. Mirrors the pattern
-- used for knowledge_base_pages_source_check in 0009.
ALTER TABLE "messages" DROP CONSTRAINT IF EXISTS "messages_source_check";--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_source_check" CHECK ("messages"."source" IN ('imap', 'smtp', 'manual', 'gmail'));