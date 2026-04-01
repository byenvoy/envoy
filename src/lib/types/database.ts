export interface Organization {
  id: string;
  name: string;
  domain: string | null;
  preferred_model: string;
  tone: "professional" | "casual" | "technical" | "friendly";
  custom_instructions: string | null;
  onboarding_step: number;
  onboarding_completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  org_id: string;
  full_name: string | null;
  role: "owner" | "agent";
  created_at: string;
}

export interface KnowledgeBasePage {
  id: string;
  org_id: string;
  url: string | null;
  title: string | null;
  source: "crawled" | "manual" | "url" | "upload" | "notion" | "confluence";
  markdown_content: string | null;
  content_hash: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeBaseChunk {
  id: string;
  page_id: string;
  org_id: string;
  chunk_index: number;
  content: string;
  token_count: number;
  embedding: number[] | null;
  content_hash: string | null;
  created_at: string;
}

export interface EmailAddress {
  id: string;
  org_id: string;
  email_address: string;
  display_name: string | null;
  is_active: boolean;
  connection_type: "oauth";
  created_at: string;
}

export interface EmailConnection {
  id: string;
  org_id: string;
  provider: "google" | "microsoft";
  email_address: string;
  display_name: string | null;
  access_token_encrypted: string;
  refresh_token_encrypted: string;
  token_expires_at: string;
  imap_host: string;
  imap_port: number;
  smtp_host: string;
  smtp_port: number;
  last_polled_at: string | null;
  last_uid: string | null;
  status: "active" | "error" | "revoked";
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export type ConversationStatus = "open" | "waiting" | "closed";

export interface Conversation {
  id: string;
  org_id: string;
  subject: string | null;
  status: ConversationStatus;
  customer_email: string;
  customer_name: string | null;
  autopilot_disabled: boolean;
  created_at: string;
  updated_at: string;
  last_message_at: string;
  search_snippet?: string | null;
}

export type MessageDirection = "inbound" | "outbound";

export interface Message {
  id: string;
  conversation_id: string;
  org_id: string;
  direction: MessageDirection;
  from_email: string;
  from_name: string | null;
  to_email: string;
  body_text: string | null;
  body_html: string | null;
  message_id: string | null;
  in_reply_to: string | null;
  source: "imap" | "smtp" | "manual";
  connection_id: string | null;
  sent_by_autopilot: boolean;
  created_at: string;
}

export type DraftStatus = "pending" | "approved" | "discarded";

export interface Draft {
  id: string;
  conversation_id: string;
  org_id: string;
  message_id: string | null;
  draft_content: string;
  edited_content: string | null;
  status: DraftStatus;
  model_used: string | null;
  chunks_used: { id: string; content: string; similarity: number; source_url?: string }[] | null;
  customer_context: Record<string, unknown> | null;
  classification_result: Record<string, unknown> | null;
  autopilot_evaluation_id: string | null;
  sent_by_autopilot: boolean;
  is_regeneration: boolean;
  approved_at: string | null;
  approved_by: string | null;
  created_at: string;
}


export interface ShopifyConfig {
  shop_domain: string;
}

export type UsageCallType =
  | "draft"
  | "classification"
  | "autopilot_classify"
  | "autopilot_retrieval_judge"
  | "autopilot_validate"
  | "autopilot_escalation";

export interface UsageLog {
  id: string;
  org_id: string;
  draft_id: string | null;
  call_type: UsageCallType;
  model: string;
  input_tokens: number;
  output_tokens: number;
  estimated_cost_usd: number;
  created_at: string;
}

export interface TeamInvite {
  id: string;
  org_id: string;
  email: string;
  role: "owner" | "agent";
  invited_by: string;
  token: string;
  accepted_at: string | null;
  expires_at: string;
  created_at: string;
}

export interface Integration {
  id: string;
  org_id: string;
  provider: "shopify";
  access_token_encrypted: string;
  config: ShopifyConfig;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type AutopilotMode = "off" | "shadow" | "auto";

export interface AutopilotTopic {
  id: string;
  org_id: string;
  name: string;
  description: string;
  embedding: number[] | null;
  mode: AutopilotMode;
  confidence_threshold: number;
  daily_send_limit: number;
  daily_sends_today: number;
  daily_sends_reset_at: string;
  created_at: string;
  updated_at: string;
}

export type AutopilotOutcome = "auto_sent" | "shadow_tagged" | "human_queue";
export type AutopilotHumanAction = "approved_no_edit" | "approved_with_edit" | "discarded";

export interface AutopilotEvaluation {
  id: string;
  org_id: string;
  conversation_id: string;
  draft_id: string | null;
  gate1_passed: boolean | null;
  gate1_topic_id: string | null;
  gate1_topic_name: string | null;
  gate1_confidence: number | null;
  gate1_embedding_similarity: number | null;
  gate1_reasoning: string | null;
  gate2_passed: boolean | null;
  gate2_confidence: number | null;
  gate2_reasoning: string | null;
  gate3_passed: boolean | null;
  gate3_needs_human_reason: string | null;
  gate4_passed: boolean | null;
  gate4_confidence: number | null;
  gate4_checks: Record<string, { pass: boolean; note: string }> | null;
  gate4_reasoning: string | null;
  all_gates_passed: boolean;
  outcome: AutopilotOutcome;
  failure_gate: number | null;
  human_action: AutopilotHumanAction | null;
  edit_distance: number | null;
  created_at: string;
}
