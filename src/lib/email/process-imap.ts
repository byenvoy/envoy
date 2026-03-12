import type { ParsedMail } from "mailparser";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateDraftForTicket } from "@/lib/email/generate-draft";
import type { EmailConnection, Ticket } from "@/lib/types/database";

export async function processImapEmail(
  parsed: ParsedMail,
  connection: EmailConnection
): Promise<Ticket | null> {
  const admin = createAdminClient();

  const fromAddr = parsed.from?.value?.[0]?.address ?? "";
  const fromName = parsed.from?.value?.[0]?.name ?? null;
  const toEmail = connection.email_address;
  const subject = parsed.subject ?? null;
  const messageId = parsed.messageId ?? null;
  const inReplyTo = parsed.inReplyTo
    ? (Array.isArray(parsed.inReplyTo) ? parsed.inReplyTo[0] : parsed.inReplyTo)
    : null;
  const bodyText = parsed.text ?? null;
  const bodyHtml = parsed.html || null;

  // Idempotency: skip if already processed
  if (messageId) {
    const { data: existing } = await admin
      .from("tickets")
      .select("id")
      .eq("message_id", messageId)
      .single();

    if (existing) return null;
  }

  // Resolve threading
  let threadId: string | null = null;
  if (inReplyTo) {
    const { data: parentTicket } = await admin
      .from("tickets")
      .select("id, thread_id")
      .eq("message_id", inReplyTo)
      .single();

    if (parentTicket) {
      threadId = parentTicket.thread_id ?? parentTicket.id;
    }
  }

  // Insert ticket
  const { data: ticket, error } = await admin
    .from("tickets")
    .insert({
      org_id: connection.org_id,
      from_email: fromAddr,
      from_name: fromName,
      to_email: toEmail,
      subject,
      body_text: bodyText,
      body_html: bodyHtml,
      message_id: messageId,
      in_reply_to: inReplyTo,
      thread_id: threadId,
      source: "imap",
      connection_id: connection.id,
      status: "new",
    })
    .select()
    .single();

  if (error) throw error;

  // Self-thread if first in conversation
  if (!threadId) {
    await admin
      .from("tickets")
      .update({ thread_id: ticket.id })
      .eq("id", ticket.id);
    ticket.thread_id = ticket.id;
  }

  // Generate draft via RAG pipeline
  await generateDraftForTicket(ticket.id);

  return ticket as Ticket;
}
