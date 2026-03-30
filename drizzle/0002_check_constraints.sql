ALTER TABLE organizations ADD CONSTRAINT organizations_tone_check CHECK (tone IN ('professional', 'casual', 'technical', 'friendly'));--> statement-breakpoint
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('owner', 'agent'));--> statement-breakpoint
ALTER TABLE email_connections ADD CONSTRAINT email_connections_provider_check CHECK (provider IN ('google', 'microsoft'));--> statement-breakpoint
ALTER TABLE email_connections ADD CONSTRAINT email_connections_status_check CHECK (status IN ('active', 'error', 'revoked'));--> statement-breakpoint
ALTER TABLE email_addresses ADD CONSTRAINT email_addresses_connection_type_check CHECK (connection_type IN ('webhook', 'oauth'));--> statement-breakpoint
ALTER TABLE integrations ADD CONSTRAINT integrations_provider_check CHECK (provider IN ('shopify'));--> statement-breakpoint
ALTER TABLE messages ADD CONSTRAINT messages_direction_check CHECK (direction IN ('inbound', 'outbound'));--> statement-breakpoint
ALTER TABLE messages ADD CONSTRAINT messages_source_check CHECK (source IN ('imap', 'smtp', 'manual'));--> statement-breakpoint
ALTER TABLE drafts ADD CONSTRAINT drafts_status_check CHECK (status IN ('pending', 'approved', 'discarded'));--> statement-breakpoint
ALTER TABLE knowledge_base_pages ADD CONSTRAINT knowledge_base_pages_source_check CHECK (source IN ('crawled', 'manual', 'url', 'upload', 'notion', 'confluence'));--> statement-breakpoint
ALTER TABLE autopilot_topics ADD CONSTRAINT autopilot_topics_mode_check CHECK (mode IN ('off', 'shadow', 'auto'));--> statement-breakpoint
ALTER TABLE autopilot_evaluations ADD CONSTRAINT autopilot_evaluations_outcome_check CHECK (outcome IN ('auto_sent', 'shadow_tagged', 'human_queue'));--> statement-breakpoint
ALTER TABLE autopilot_evaluations ADD CONSTRAINT autopilot_evaluations_human_action_check CHECK (human_action IN ('approved_no_edit', 'approved_with_edit', 'discarded'));--> statement-breakpoint
ALTER TABLE team_invites ADD CONSTRAINT team_invites_role_check CHECK (role IN ('owner', 'agent'));--> statement-breakpoint
ALTER TABLE usage_logs ADD CONSTRAINT usage_logs_call_type_check CHECK (call_type IN ('draft', 'classification', 'autopilot_classify', 'autopilot_retrieval_judge', 'autopilot_validate', 'autopilot_escalation'));
