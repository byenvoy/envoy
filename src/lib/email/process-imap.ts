import type { ParsedMail } from "mailparser";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateDraftForConversation } from "@/lib/email/generate-draft";
import type { EmailConnection, Conversation } from "@/lib/types/database";

export async function processImapEmail(
  parsed: ParsedMail,
  connection: EmailConnection
): Promise<Conversation | null> {
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

  // Idempotency: skip if message already processed
  if (messageId) {
    const { data: existing } = await admin
      .from("messages")
      .select("id")
      .eq("message_id", messageId)
      .single();

    if (existing) return null;
  }

  // Resolve conversation via in_reply_to
  // This now finds both inbound AND outbound messages since both are in the messages table
  let conversationId: string | null = null;
  if (inReplyTo) {
    const { data: parentMessage } = await admin
      .from("messages")
      .select("conversation_id")
      .eq("message_id", inReplyTo)
      .single();

    if (parentMessage) {
      conversationId = parentMessage.conversation_id;
    }
  }

  // Fallback: match by subject + customer email if in_reply_to didn't resolve
  if (!conversationId && subject) {
    const normalizedSubject = subject.replace(/^(Re|Fwd|Fw):\s*/gi, "").trim();
    const { data: matchingConvo } = await admin
      .from("conversations")
      .select("id")
      .eq("org_id", connection.org_id)
      .eq("customer_email", fromAddr)
      .ilike("subject", normalizedSubject)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (matchingConvo) {
      conversationId = matchingConvo.id;
    }
  }

  // Create new conversation if no thread found
  if (!conversationId) {
    const { data: conversation, error: convoError } = await admin
      .from("conversations")
      .insert({
        org_id: connection.org_id,
        subject,
        status: "open",
        customer_email: fromAddr,
        customer_name: fromName,
      })
      .select()
      .single();

    if (convoError) throw convoError;
    conversationId = conversation.id;
  } else {
    // Reopen conversation if it was waiting/closed
    await admin
      .from("conversations")
      .update({ status: "open", last_message_at: new Date().toISOString() })
      .eq("id", conversationId);
  }

  // Insert inbound message
  const { error: msgError } = await admin
    .from("messages")
    .insert({
      conversation_id: conversationId,
      org_id: connection.org_id,
      direction: "inbound",
      from_email: fromAddr,
      from_name: fromName,
      to_email: toEmail,
      body_text: bodyText,
      body_html: bodyHtml,
      message_id: messageId,
      in_reply_to: inReplyTo,
      source: "imap",
      connection_id: connection.id,
    });

  if (msgError) throw msgError;

  // Generate draft via RAG pipeline
  await generateDraftForConversation(conversationId!);

  // Return conversation
  const { data: conversation } = await admin
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .single();

  return conversation as Conversation;
}
