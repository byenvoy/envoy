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

  // Atomically create/reopen the conversation and insert the message. Wrapping
  // both in one transaction means a failed message insert — a message_id race,
  // or any DB constraint rejection — rolls back a freshly-created conversation
  // instead of leaving it orphaned with no messages. An orphan conversation
  // otherwise lingers in the inbox and 500s on regenerate ("No messages in
  // conversation"). draft_state starts at 'generating'; the dispatcher records
  // the pipeline's decision (drafted/escalated/skipped/failed) later.
  const DUPLICATE = Symbol("duplicate-message");
  try {
    return await db.transaction(async (tx) => {
      let convId = conversationId;
      if (!convId) {
        const conversation = await tx
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
          .returning({ id: conversations.id })
          .then((r) => r[0]);

        if (!conversation) throw new Error("Failed to create conversation");
        convId = conversation.id;
      } else {
        // Reopen if waiting/closed; reset draft_state for the new inbound.
        await tx
          .update(conversations)
          .set({
            status: "open",
            draftState: "generating",
            updatedAt: new Date(),
            lastMessageAt: parsed.date ?? new Date(),
          })
          .where(eq(conversations.id, convId));
      }

      // The dedup SELECT above is not atomic with this insert, so overlapping
      // polls can both pass it and race here. onConflictDoNothing makes the DB
      // the source of truth: the loser inserts nothing on the message_id unique
      // constraint rather than crashing.
      const inserted = await tx
        .insert(messages)
        .values({
          conversationId: convId,
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
        })
        .onConflictDoNothing({ target: messages.messageId })
        .returning({ id: messages.id });

      // Lost the race: roll the whole transaction back (undoing any
      // freshly-created conversation) and tell the caller to skip.
      if (inserted.length === 0) throw DUPLICATE;

      return convId;
    });
  } catch (err) {
    if (err === DUPLICATE) return null;
    throw err;
  }
}
