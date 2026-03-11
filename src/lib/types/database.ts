export interface Organization {
  id: string;
  name: string;
  domain: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  org_id: string;
  full_name: string | null;
  created_at: string;
}

export interface KnowledgeBasePage {
  id: string;
  org_id: string;
  url: string;
  title: string | null;
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
  connection_type: "webhook" | "oauth";
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

export type TicketStatus = "new" | "draft_generated" | "approved" | "sent" | "discarded";

export interface Ticket {
  id: string;
  org_id: string;
  from_email: string;
  from_name: string | null;
  to_email: string;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  message_id: string | null;
  in_reply_to: string | null;
  thread_id: string | null;
  inbound_email_id: string | null;
  source: "webhook" | "imap";
  connection_id: string | null;
  status: TicketStatus;
  created_at: string;
}

export interface DraftReply {
  id: string;
  ticket_id: string;
  org_id: string;
  draft_content: string;
  edited_content: string | null;
  was_approved: boolean | null;
  model_used: string | null;
  chunks_used: { id: string; content: string; similarity: number; source_url?: string }[] | null;
  customer_context: Record<string, unknown> | null;
  classification_result: Record<string, unknown> | null;
  created_at: string;
}

export interface ShopifyConfig {
  shop_domain: string;
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
