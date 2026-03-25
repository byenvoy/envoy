import { createAdminClient } from "@/lib/supabase/admin";
import { getValidTokens } from "./oauth-tokens";
import { createTransport } from "nodemailer";
import type { Conversation, Message, EmailConnection } from "@/lib/types/database";

interface SendReplyParams {
  conversation: Conversation;
  latestInboundMessage: Message;
  replyContent: string;
  replyHtml: string;
  emailAddr: { email_address: string; display_name: string | null };
  connectionId: string;
}

/**
 * Sends a reply via SMTP and creates an outbound message row.
 * Returns the created message ID.
 */
export async function sendReply({
  conversation,
  latestInboundMessage,
  replyContent,
  replyHtml,
  emailAddr,
  connectionId,
}: SendReplyParams): Promise<string> {
  const admin = createAdminClient();
  const { data: connection } = await admin
    .from("email_connections")
    .select("*")
    .eq("id", connectionId)
    .single();

  if (!connection) throw new Error("Email connection not found");

  const tokens = await getValidTokens(connection as EmailConnection);

  const transport = createTransport({
    host: connection.smtp_host,
    port: connection.smtp_port,
    secure: false,
    auth: {
      type: "OAuth2",
      user: connection.email_address,
      accessToken: tokens.access_token,
    },
  });

  const from = emailAddr.display_name
    ? `${emailAddr.display_name} <${emailAddr.email_address}>`
    : emailAddr.email_address;

  const subject = conversation.subject
    ? `Re: ${conversation.subject.replace(/^Re:\s*/i, "")}`
    : undefined;

  const info = await transport.sendMail({
    from,
    to: conversation.customer_email,
    subject,
    text: replyContent,
    html: replyHtml,
    inReplyTo: latestInboundMessage.message_id ?? undefined,
    references: latestInboundMessage.message_id
      ? [latestInboundMessage.message_id]
      : undefined,
  });

  // Create outbound message row with the sent message ID
  const { data: outboundMsg, error } = await admin
    .from("messages")
    .insert({
      conversation_id: conversation.id,
      org_id: conversation.org_id,
      direction: "outbound",
      from_email: emailAddr.email_address,
      from_name: emailAddr.display_name,
      to_email: conversation.customer_email,
      body_text: replyContent,
      body_html: replyHtml,
      message_id: info.messageId ?? null,
      in_reply_to: latestInboundMessage.message_id,
      source: "smtp",
      connection_id: connectionId,
    })
    .select("id")
    .single();

  if (error) throw error;

  // Update conversation status to waiting
  await admin
    .from("conversations")
    .update({ status: "waiting", updated_at: new Date().toISOString() })
    .eq("id", conversation.id);

  return outboundMsg.id;
}
