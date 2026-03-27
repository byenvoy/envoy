CREATE TYPE "public"."conversation_status" AS ENUM('open', 'waiting', 'closed');--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"domain" text,
	"preferred_model" text DEFAULT 'claude-haiku-4-5-20251001' NOT NULL,
	"tone" text DEFAULT 'professional' NOT NULL,
	"custom_instructions" text,
	"onboarding_completed_at" timestamp with time zone,
	"onboarding_step" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"org_id" uuid NOT NULL,
	"full_name" text,
	"role" text DEFAULT 'owner' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_base_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"chunk_index" integer NOT NULL,
	"content" text NOT NULL,
	"token_count" integer NOT NULL,
	"embedding" vector(1536),
	"content_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_base_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"url" text,
	"title" text,
	"markdown_content" text,
	"content_hash" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"source" text DEFAULT 'crawled' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "knowledge_base_pages_org_url_unique" UNIQUE("org_id","url")
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"subject" text,
	"status" "conversation_status" DEFAULT 'open' NOT NULL,
	"customer_email" text NOT NULL,
	"customer_name" text,
	"autopilot_disabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"message_id" uuid,
	"draft_content" text NOT NULL,
	"edited_content" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"model_used" text,
	"chunks_used" jsonb,
	"customer_context" jsonb,
	"classification_result" jsonb,
	"approved_at" timestamp with time zone,
	"approved_by" uuid,
	"autopilot_evaluation_id" uuid,
	"sent_by_autopilot" boolean DEFAULT false NOT NULL,
	"is_regeneration" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"direction" text NOT NULL,
	"from_email" text NOT NULL,
	"from_name" text,
	"to_email" text NOT NULL,
	"body_text" text,
	"body_html" text,
	"message_id" text,
	"in_reply_to" text,
	"source" text DEFAULT 'imap' NOT NULL,
	"connection_id" uuid,
	"sent_by_autopilot" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"email_address" text NOT NULL,
	"display_name" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"connection_type" text DEFAULT 'webhook' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_addresses_email_address_unique" UNIQUE("email_address")
);
--> statement-breakpoint
CREATE TABLE "email_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"email_address" text NOT NULL,
	"display_name" text,
	"access_token_encrypted" text NOT NULL,
	"refresh_token_encrypted" text NOT NULL,
	"token_expires_at" timestamp with time zone NOT NULL,
	"imap_host" text NOT NULL,
	"imap_port" integer DEFAULT 993 NOT NULL,
	"smtp_host" text NOT NULL,
	"smtp_port" integer DEFAULT 587 NOT NULL,
	"last_polled_at" timestamp with time zone,
	"last_uid" text,
	"status" text DEFAULT 'active' NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_connections_org_id_provider" UNIQUE("org_id","provider")
);
--> statement-breakpoint
CREATE TABLE "integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"access_token_encrypted" text NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "integrations_org_id_provider" UNIQUE("org_id","provider")
);
--> statement-breakpoint
CREATE TABLE "org_api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"provider_key" text NOT NULL,
	"api_key_encrypted" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "org_api_keys_org_id_provider_key" UNIQUE("org_id","provider_key")
);
--> statement-breakpoint
CREATE TABLE "team_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'agent' NOT NULL,
	"invited_by" uuid NOT NULL,
	"token" text NOT NULL,
	"accepted_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_invites_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "usage_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"draft_id" uuid,
	"call_type" text NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer NOT NULL,
	"output_tokens" integer NOT NULL,
	"estimated_cost_usd" numeric(10, 6) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "autopilot_evaluations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"draft_id" uuid,
	"gate1_passed" boolean,
	"gate1_topic_id" uuid,
	"gate1_topic_name" text,
	"gate1_confidence" numeric,
	"gate1_embedding_similarity" numeric,
	"gate1_reasoning" text,
	"gate2_passed" boolean,
	"gate2_confidence" numeric,
	"gate2_reasoning" text,
	"gate3_passed" boolean,
	"gate3_needs_human_reason" text,
	"gate4_passed" boolean,
	"gate4_confidence" numeric,
	"gate4_checks" jsonb,
	"gate4_reasoning" text,
	"all_gates_passed" boolean DEFAULT false NOT NULL,
	"outcome" text DEFAULT 'human_queue' NOT NULL,
	"failure_gate" integer,
	"human_action" text,
	"edit_distance" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "autopilot_topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"embedding" vector(1536),
	"mode" text DEFAULT 'off' NOT NULL,
	"confidence_threshold" numeric DEFAULT '0.95' NOT NULL,
	"daily_send_limit" integer DEFAULT 100 NOT NULL,
	"daily_sends_today" integer DEFAULT 0 NOT NULL,
	"daily_sends_reset_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_base_chunks" ADD CONSTRAINT "knowledge_base_chunks_page_id_knowledge_base_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."knowledge_base_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_base_chunks" ADD CONSTRAINT "knowledge_base_chunks_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_base_pages" ADD CONSTRAINT "knowledge_base_pages_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_addresses" ADD CONSTRAINT "email_addresses_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_connections" ADD CONSTRAINT "email_connections_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_api_keys" ADD CONSTRAINT "org_api_keys_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invites" ADD CONSTRAINT "team_invites_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invites" ADD CONSTRAINT "team_invites_invited_by_profiles_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_logs" ADD CONSTRAINT "usage_logs_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "autopilot_evaluations" ADD CONSTRAINT "autopilot_evaluations_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "autopilot_evaluations" ADD CONSTRAINT "autopilot_evaluations_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "autopilot_topics" ADD CONSTRAINT "autopilot_topics_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "knowledge_base_chunks_page_id_idx" ON "knowledge_base_chunks" USING btree ("page_id");--> statement-breakpoint
CREATE INDEX "knowledge_base_chunks_org_id_idx" ON "knowledge_base_chunks" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "conversations_org_id" ON "conversations" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "conversations_org_status" ON "conversations" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "conversations_org_updated" ON "conversations" USING btree ("org_id","updated_at" desc);--> statement-breakpoint
CREATE INDEX "drafts_conversation_id" ON "drafts" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "drafts_org_id" ON "drafts" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "messages_conversation_id" ON "messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "messages_org_id" ON "messages" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "messages_message_id" ON "messages" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "messages_conversation_created" ON "messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "email_connections_org_id" ON "email_connections" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "email_connections_status" ON "email_connections" USING btree ("status");--> statement-breakpoint
CREATE INDEX "integrations_org_id" ON "integrations" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "integrations_provider" ON "integrations" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "usage_logs_org_created" ON "usage_logs" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE INDEX "autopilot_evaluations_org_id" ON "autopilot_evaluations" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "autopilot_evaluations_conversation_id" ON "autopilot_evaluations" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "autopilot_evaluations_topic_id" ON "autopilot_evaluations" USING btree ("gate1_topic_id");--> statement-breakpoint
CREATE INDEX "autopilot_evaluations_org_outcome" ON "autopilot_evaluations" USING btree ("org_id","outcome");--> statement-breakpoint
CREATE INDEX "autopilot_topics_org_id" ON "autopilot_topics" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "autopilot_topics_org_mode" ON "autopilot_topics" USING btree ("org_id","mode");