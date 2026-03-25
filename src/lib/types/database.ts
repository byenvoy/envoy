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
  created_at: string;
  updated_at: string;
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
  approved_at: string | null;
  approved_by: string | null;
  created_at: string;
}


export interface ShopifyConfig {
  shop_domain: string;
}

export interface UsageLog {
  id: string;
  org_id: string;
  draft_id: string | null;
  call_type: "draft" | "classification";
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
