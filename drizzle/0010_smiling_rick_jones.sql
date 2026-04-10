ALTER TABLE "organizations" ALTER COLUMN "preferred_model" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "organizations" ALTER COLUMN "preferred_model" DROP NOT NULL;