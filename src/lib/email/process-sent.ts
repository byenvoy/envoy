import type { ParsedMail } from "mailparser";
import { db } from "@/lib/db";
import { conversations, messages, emailConnections } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";

type EmailConnectionRow = typeof emailConnections.$inferSelect;

/**
 * Ingest a sent email from the Sent folder.
 * Only adds to existing conversations (no new conversation creation).
 * Returns the conversation ID if processed, null if skipped.
 */
export async function processSentEmail(
  parsed: ParsedMail,
  connection: EmailConnectionRow
): Promise<string | null> {
  const fromAddr = parsed.from?.value?.[0]?.address ?? "";
  const fromName = parsed.from?.value?.[0]?.name ?? null;
  const toAddr = parsed.to
    ? (Array.isArray(parsed.to) ? parsed.to[0] : parsed.to).value?.[0]?.address ?? ""
    : "";
  const messageId = parsed.messageId ?? null;
  const inReplyTo = parsed.inReplyTo
    ? (Array.isArray(parsed.inReplyTo) ? parsed.inReplyTo[0] : parsed.inReplyTo)
    : null;
  const bodyText = parsed.text ?? null;
  const bodyHtml = parsed.html || null;

  // Idempotency: skip if message already processed
  if (messageId) {
    const existing = await db
      .select({ id: messages.id })
      .from(messages)
      .where(eq(messages.messageId, messageId))
      .then((r) => r[0]);

    if (existing) return null;
  }

  // Find existing conversation via in_reply_to
  let conversationId: string | null = null;

  if (inReplyTo) {
    const parentMessage = await db
      .select({ conversationId: messages.conversationId })
      .from(messages)
      .where(eq(messages.messageId, inReplyTo))
      .then((r) => r[0]);

    if (parentMessage) {
      conversationId = parentMessage.conversationId;
    }
  }

  // Fallback: check References header for any ancestor in the thread
  if (!conversationId && parsed.references) {
    const refs = Array.isArray(parsed.references) ? parsed.references : [parsed.references];
    if (refs.length > 0) {
      const ancestorMessage = await db
        .select({ conversationId: messages.conversationId })
        .from(messages)
        .where(inArray(messages.messageId, refs))
        .limit(1)
        .then((r) => r[0]);

      if (ancestorMessage) {
        conversationId = ancestorMessage.conversationId;
      }
    }
  }

  // Only add to existing conversations
  if (!conversationId) return null;

  // Insert outbound message
  await db.insert(messages).values({
    conversationId,
    orgId: connection.orgId,
    direction: "outbound",
    fromEmail: fromAddr,
    fromName,
    toEmail: toAddr,
    bodyText,
    bodyHtml,
    messageId,
    inReplyTo,
    source: "imap",
    connectionId: connection.id,
    sentAt: parsed.date ?? new Date(),
  });

  // Update conversation timestamp
  await db
    .update(conversations)
    .set({ updatedAt: new Date(), lastMessageAt: parsed.date ?? new Date() })
    .where(eq(conversations.id, conversationId));

  return conversationId;
}
