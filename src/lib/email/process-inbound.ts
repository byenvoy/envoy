import type { InboundWebhookPayload } from "inboundemail";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Ticket } from "@/lib/types/database";

export async function processInboundEmail(
  payload: InboundWebhookPayload
): Promise<Ticket | null> {
  const admin = createAdminClient();
  const { email } = payload;

  const fromAddress = email.from.addresses[0];
  const fromEmail = fromAddress?.address ?? "";
  const fromName = fromAddress?.name ?? null;
  const recipient = email.recipient;
  const subject = email.subject;
  const messageId = email.messageId;
  const inReplyTo = email.parsedData.inReplyTo ?? null;
  const bodyText = email.parsedData.textBody;
  const bodyHtml = email.parsedData.htmlBody;
  const inboundEmailId = email.id;

  // Look up recipient address → org_id
  const { data: emailAddr } = await admin
    .from("email_addresses")
    .select("org_id")
    .eq("email_address", recipient)
    .eq("is_active", true)
    .single();

  if (!emailAddr) return null;

  const orgId = emailAddr.org_id;

  // Idempotency: skip if already processed
  const { data: existing } = await admin
    .from("tickets")
    .select("id")
    .eq("inbound_email_id", inboundEmailId)
    .single();

  if (existing) return null;

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
      org_id: orgId,
      from_email: fromEmail,
      from_name: fromName,
      to_email: recipient,
      subject,
      body_text: bodyText,
      body_html: bodyHtml,
      message_id: messageId,
      in_reply_to: inReplyTo,
      thread_id: threadId,
      inbound_email_id: inboundEmailId,
      status: "new",
    })
    .select()
    .single();

  if (error) throw error;

  // If this is the first message in a thread, set thread_id to its own id
  if (!threadId) {
    await admin
      .from("tickets")
      .update({ thread_id: ticket.id })
      .eq("id", ticket.id);
    ticket.thread_id = ticket.id;
  }

  return ticket as Ticket;
}
