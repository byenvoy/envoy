import type { ParsedMail } from "mailparser";
import { db } from "@/lib/db";
import { conversations, messages, drafts, emailConnections } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { generateDraftForConversation } from "@/lib/email/generate-draft";
import { checkAndEscalateThread } from "@/lib/autopilot/escalation";

type EmailConnectionRow = typeof emailConnections.$inferSelect;

export async function processImapEmail(
  parsed: ParsedMail,
  connection: EmailConnectionRow
): Promise<typeof conversations.$inferSelect | null> {
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

  // Resolve conversation via in_reply_to
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

  // Create new conversation if no thread found
  if (!conversationId) {
    const conversation = await db
      .insert(conversations)
      .values({
        orgId: connection.orgId,
        subject,
        status: "open",
        customerEmail: fromAddr,
        customerName: fromName,
      })
      .returning()
      .then((r) => r[0]);

    if (!conversation) throw new Error("Failed to create conversation");
    conversationId = conversation.id;
  } else {
    // Reopen conversation if it was waiting/closed
    await db
      .update(conversations)
      .set({ status: "open", updatedAt: new Date(), lastMessageAt: new Date() })
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
    source: "imap",
    connectionId: connection.id,
  });

  // Check for escalation if this is a reply to an auto-sent message
  if (conversationId && bodyText) {
    try {
      const lastDraft = await db
        .select({ sentByAutopilot: drafts.sentByAutopilot })
        .from(drafts)
        .where(
          and(
            eq(drafts.conversationId, conversationId),
            eq(drafts.status, "approved")
          )
        )
        .orderBy(desc(drafts.createdAt))
        .limit(1)
        .then((r) => r[0]);

      if (lastDraft?.sentByAutopilot) {
        await checkAndEscalateThread({
          conversationId,
          customerMessage: bodyText,
          orgId: connection.orgId,
        });
      }
    } catch {
      // Escalation check failure should not block processing
    }
  }

  // Generate draft via RAG pipeline
  await generateDraftForConversation(conversationId!);

  // Return conversation
  const conversation = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .then((r) => r[0]);

  return conversation ?? null;
}
