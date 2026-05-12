ALTER TABLE "drafts" ADD COLUMN "category" text;--> statement-breakpoint
-- Backfill from existing classification_result JSONB.
-- Agent pipeline writes { "category": "..." }; classic pipeline writes { "query_type": "..." }.
-- COALESCE picks whichever is present. Rows with no classification_result stay NULL.
UPDATE "drafts"
SET "category" = COALESCE(
  "classification_result"->>'category',
  "classification_result"->>'query_type'
)
WHERE "category" IS NULL
  AND "classification_result" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "drafts_org_category" ON "drafts" USING btree ("org_id","category");