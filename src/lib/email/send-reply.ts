import { db } from "@/lib/db";
import { messages, conversations, emailConnections } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
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
  sentByAutopilot?: boolean;
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
  sentByAutopilot = false,
}: SendReplyParams): Promise<string> {
  const connection = await db
    .select()
    .from(emailConnections)
    .where(eq(emailConnections.id, connectionId))
    .then((r) => r[0]);

  if (!connection) throw new Error("Email connection not found");

  const tokens = await getValidTokens(connection as unknown as EmailConnection);

  const transport = createTransport({
    host: connection.smtpHost,
    port: connection.smtpPort,
    secure: false,
    auth: {
      type: "OAuth2",
      user: connection.emailAddress,
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
  const outboundMsg = await db
    .insert(messages)
    .values({
      conversationId: conversation.id,
      orgId: conversation.org_id,
      direction: "outbound",
      fromEmail: emailAddr.email_address,
      fromName: emailAddr.display_name,
      toEmail: conversation.customer_email,
      bodyText: replyContent,
      bodyHtml: replyHtml,
      messageId: info.messageId ?? null,
      inReplyTo: latestInboundMessage.message_id,
      source: "smtp",
      connectionId,
      sentByAutopilot,
    })
    .returning({ id: messages.id })
    .then((r) => r[0]);

  if (!outboundMsg) throw new Error("Failed to insert outbound message");

  // Update conversation status to waiting
  await db
    .update(conversations)
    .set({ status: "waiting", updatedAt: new Date() })
    .where(eq(conversations.id, conversation.id));

  return outboundMsg.id;
}
