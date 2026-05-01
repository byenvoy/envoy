import type { ParsedMail } from "mailparser";
import type { emailConnections } from "@/lib/db/schema";

export type EmailConnectionRow = typeof emailConnections.$inferSelect;

export interface CollectedMessage {
  folder: "inbox" | "sent";
  parsed: ParsedMail;
  date: Date;
  /** Provider-native thread identifier (Gmail threadId). Undefined for IMAP. */
  providerThreadId?: string;
}

export interface CursorUpdate {
  /** Gmail incremental sync cursor */
  historyId?: string | null;
  /** IMAP UID watermarks */
  lastUid?: string | null;
  lastSentUid?: string | null;
}

export interface PollResult {
  messages: CollectedMessage[];
  cursorUpdate: CursorUpdate;
}

export interface SendArgs {
  /** Formatted "Name <email>" or just email */
  from: string;
  to: string;
  subject?: string;
  text: string;
  html: string;
  inReplyTo?: string;
  references?: string[];
  /** Provider-native thread to reply within (Gmail threadId) */
  providerThreadId?: string;
}

export interface SendResult {
  /** RFC 5322 Message-ID header value */
  messageId: string | null;
  /** Provider-native thread ID returned by the API */
  providerThreadId?: string;
}

export interface EmailTransport {
  poll(connection: EmailConnectionRow): Promise<PollResult>;
  send(connection: EmailConnectionRow, args: SendArgs): Promise<SendResult>;
}
