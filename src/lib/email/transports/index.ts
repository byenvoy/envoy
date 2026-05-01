import { gmailTransport } from "./gmail";
import { imapSmtpTransport } from "./imap";
import type { EmailConnectionRow, EmailTransport } from "./types";

export function getTransport(connection: EmailConnectionRow): EmailTransport {
  if (connection.provider === "google") return gmailTransport;
  return imapSmtpTransport;
}

export type { EmailTransport, SendArgs, SendResult, PollResult, CollectedMessage } from "./types";
