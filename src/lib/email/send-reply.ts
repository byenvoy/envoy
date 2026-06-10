import { db } from "@/lib/db";
import { messages, conversations, emailConnections } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getTransport } from "./transports";
import { markGmailThreadRead } from "./gmail-sync";

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
 * Sends a reply via the connection's transport (Gmail REST or IMAP/SMTP)
 * and creates an outbound message row. Returns the created message ID.
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

  // Look up cached Gmail threadId for this conversation, if any
  const conversationRow = await db
    .select({ gmailThreadId: conversations.gmailThreadId })
    .from(conversations)
    .where(eq(conversations.id, conversation.id))
    .then((r) => r[0]);

  const from = emailAddr.displayName
    ? `${emailAddr.displayName} <${emailAddr.emailAddress}>`
    : emailAddr.emailAddress;

  const subject = conversation.subject
    ? `Re: ${conversation.subject.replace(/^Re:\s*/i, "")}`
    : undefined;

  const transport = getTransport(connection);
  const sendResult = await transport.send(connection, {
    from,
    to: conversation.customerEmail,
    subject,
    text: replyContent,
    html: replyHtml,
    inReplyTo: latestInboundMessage.messageId ?? undefined,
    references: latestInboundMessage.messageId
      ? [latestInboundMessage.messageId]
      : undefined,
    providerThreadId: conversationRow?.gmailThreadId ?? undefined,
  });

  // Persist provider thread ID if we discovered one
  if (sendResult.providerThreadId && !conversationRow?.gmailThreadId) {
    await db
      .update(conversations)
      .set({ gmailThreadId: sendResult.providerThreadId })
      .where(eq(conversations.id, conversation.id));
  }

  const source = connection.provider === "google" ? "gmail" : "smtp";

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
      messageId: sendResult.messageId ?? null,
      inReplyTo: latestInboundMessage.messageId,
      source,
      connectionId,
      sentByAutopilot,
    })
    .returning({ id: messages.id })
    .then((r) => r[0]);

  if (!outboundMsg) throw new Error("Failed to insert outbound message");

  await db
    .update(conversations)
    .set({ status: "waiting", updatedAt: new Date(), lastMessageAt: new Date() })
    .where(eq(conversations.id, conversation.id));

  // Fire-and-forget: now that we've responded, mark the Gmail thread as
  // read. Centralized here so every send path (user-triggered, autopilot,
  // anything future) inherits the behavior automatically. Uses the
  // freshest threadId — sendResult takes precedence since it might have
  // been populated for the first time on this very send.
  const threadIdForSync = sendResult.providerThreadId ?? conversationRow?.gmailThreadId ?? null;
  if (threadIdForSync) {
    void markGmailThreadRead(threadIdForSync, connection);
  }

  return outboundMsg.id;
}
