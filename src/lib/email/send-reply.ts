import { db } from "@/lib/db";
import { messages, conversations, emailConnections } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getValidTokens } from "./oauth-tokens";
import { createTransport } from "nodemailer";

interface SendReplyParams {
  conversation: {
    id: string;
    orgId: string;
    subject: string | null;
    customerEmail: string;
  };
  latestInboundMessage: {
    messageId: string | null;
  };
  replyContent: string;
  replyHtml: string;
  emailAddr: { emailAddress: string; displayName: string | null };
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

  const tokens = await getValidTokens(connection);

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

  const from = emailAddr.displayName
    ? `${emailAddr.displayName} <${emailAddr.emailAddress}>`
    : emailAddr.emailAddress;

  const subject = conversation.subject
    ? `Re: ${conversation.subject.replace(/^Re:\s*/i, "")}`
    : undefined;

  const info = await transport.sendMail({
    from,
    to: conversation.customerEmail,
    subject,
    text: replyContent,
    html: replyHtml,
    inReplyTo: latestInboundMessage.messageId ?? undefined,
    references: latestInboundMessage.messageId
      ? [latestInboundMessage.messageId]
      : undefined,
  });

  // Create outbound message row with the sent message ID
  const outboundMsg = await db
    .insert(messages)
    .values({
      conversationId: conversation.id,
      orgId: conversation.orgId,
      direction: "outbound",
      fromEmail: emailAddr.emailAddress,
      fromName: emailAddr.displayName,
      toEmail: conversation.customerEmail,
      bodyText: replyContent,
      bodyHtml: replyHtml,
      messageId: info.messageId ?? null,
      inReplyTo: latestInboundMessage.messageId,
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
    .set({ status: "waiting", updatedAt: new Date(), lastMessageAt: new Date() })
    .where(eq(conversations.id, conversation.id));

  return outboundMsg.id;
}
