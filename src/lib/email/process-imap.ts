import type { ParsedMail } from "mailparser";
import { db } from "@/lib/db";
import { conversations, messages, emailConnections } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import type { MessageSource } from "./transports/types";
import { isAutomatedEmail } from "./detect-automated";

type EmailConnectionRow = typeof emailConnections.$inferSelect;

/**
 * Ingest an inbound email into the database.
 * Only handles message storage and conversation threading.
 * Returns the conversation ID if processed, null if skipped (duplicate).
 *
 * Draft generation and escalation checks are handled separately
 * by the caller after all messages have been ingested.
 */
export async function processImapEmail(
  parsed: ParsedMail,
  connection: EmailConnectionRow,
  source: MessageSource
): Promise<string | null> {
  const fromAddr = parsed.from?.value?.[0]?.address ?? "";
  const fromName = parsed.from?.value?.[0]?.name ?? null;
  const toEmail = connection.emailAddress;
  const subject = parsed.subject ?? null;
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

  // Resolve conversation via in_reply_to, falling back to references chain
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

  // Create new conversation if no thread found. draft_state starts at
  // 'generating' — the dispatcher records the pipeline's decision
  // (drafted/escalated/skipped/failed) once it processes this message.
  if (!conversationId) {
    const conversation = await db
      .insert(conversations)
      .values({
        orgId: connection.orgId,
        subject,
        status: "open",
        draftState: "generating",
        customerEmail: fromAddr,
        customerName: fromName,
        lastMessageAt: parsed.date ?? new Date(),
      })
      .returning()
      .then((r) => r[0]);

    if (!conversation) throw new Error("Failed to create conversation");
    conversationId = conversation.id;
  } else {
    // Reopen conversation if it was waiting/closed; reset draft_state for
    // the new inbound so the pipeline decision is re-recorded.
    await db
      .update(conversations)
      .set({
        status: "open",
        draftState: "generating",
        updatedAt: new Date(),
        lastMessageAt: parsed.date ?? new Date(),
      })
      .where(eq(conversations.id, conversationId));
  }

  // Insert inbound message
  await db.insert(messages).values({
    conversationId,
    orgId: connection.orgId,
    direction: "inbound",
    fromEmail: fromAddr,
    fromName,
    toEmail,
    bodyText,
    bodyHtml,
    messageId,
    inReplyTo,
    source,
    connectionId: connection.id,
    isAutomated: isAutomatedEmail(parsed),
    sentAt: parsed.date ?? new Date(),
  });

  return conversationId;
}
