import type { ParsedMail } from "mailparser";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateDraftForConversation } from "@/lib/email/generate-draft";
import { checkAndEscalateThread } from "@/lib/autopilot/escalation";
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

  // Check for escalation if this is a reply to an auto-sent message
  if (conversationId && bodyText) {
    try {
      const { data: lastDraft } = await admin
        .from("drafts")
        .select("sent_by_autopilot")
        .eq("conversation_id", conversationId)
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (lastDraft?.sent_by_autopilot) {
        await checkAndEscalateThread({
          supabase: admin,
          conversationId,
          customerMessage: bodyText,
          orgId: connection.org_id,
        });
      }
    } catch {
      // Escalation check failure should not block processing
    }
  }

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
