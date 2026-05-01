import { db } from "@/lib/db";
import { emailConnections, conversations, messages, drafts } from "@/lib/db/schema";
import { eq, and, desc, isNull } from "drizzle-orm";
import { processImapEmail } from "./process-imap";
import { processSentEmail } from "./process-sent";
import { generateDraftForConversation } from "./generate-draft";
import { checkAndEscalateThread } from "@/lib/autopilot/escalation";
import { getTransport } from "./transports";

type EmailConnectionRow = typeof emailConnections.$inferSelect;

/**
 * Poll an email connection for new messages, ingest them, and trigger
 * draft generation / escalation. The transport (Gmail REST vs IMAP) is
 * selected per-connection by the dispatcher.
 */
export async function pollConnection(
  connection: EmailConnectionRow
): Promise<number> {
  const transport = getTransport(connection);
  const result = await transport.poll(connection);
  let processed = 0;

  // --- Phase 1: Ingest all messages in chronological order ---
  const allMessages = [...result.messages].sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  );

  const touchedConversationIds = new Set<string>();

  for (const msg of allMessages) {
    let conversationId: string | null = null;
    if (msg.folder === "inbox") {
      conversationId = await processImapEmail(msg.parsed, connection, msg.source);
    } else {
      conversationId = await processSentEmail(msg.parsed, connection, msg.source);
    }
    if (conversationId) {
      touchedConversationIds.add(conversationId);
      processed++;

      // Cache Gmail thread ID on the conversation for future replies
      if (msg.providerThreadId) {
        await db
          .update(conversations)
          .set({ gmailThreadId: msg.providerThreadId })
          .where(
            and(
              eq(conversations.id, conversationId),
              isNull(conversations.gmailThreadId)
            )
          );
      }
    }
  }

  // --- Phase 2: Escalation checks + draft generation ---
  for (const conversationId of touchedConversationIds) {
    const lastMsg = await db
      .select({ direction: messages.direction, bodyText: messages.bodyText })
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(desc(messages.createdAt))
      .limit(1)
      .then((r) => r[0]);

    // If the last message is outbound, the agent already replied — set to waiting
    if (lastMsg?.direction !== "inbound") {
      await db
        .update(conversations)
        .set({ status: "waiting", updatedAt: new Date() })
        .where(eq(conversations.id, conversationId));
      continue;
    }

    // Skip if a pending draft already exists
    const existingDraft = await db
      .select({ id: drafts.id })
      .from(drafts)
      .where(
        and(
          eq(drafts.conversationId, conversationId),
          eq(drafts.status, "pending")
        )
      )
      .limit(1)
      .then((r) => r[0]);

    if (existingDraft) continue;

    // Escalation check: was the last approved draft auto-sent?
    if (lastMsg.bodyText) {
      try {
        const lastApprovedDraft = await db
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

        if (lastApprovedDraft?.sentByAutopilot) {
          await checkAndEscalateThread({
            conversationId,
            customerMessage: lastMsg.bodyText,
            orgId: connection.orgId,
          });
        }
      } catch {
        // Escalation check failure should not block draft generation
      }
    }

    await generateDraftForConversation(conversationId);
  }

  // --- Phase 3: Update connection state ---
  const update: Partial<typeof emailConnections.$inferInsert> = {
    lastPolledAt: new Date(),
    status: "active",
    errorMessage: null,
  };
  if (result.cursorUpdate.historyId !== undefined) {
    update.historyId = result.cursorUpdate.historyId;
  }
  if (result.cursorUpdate.lastUid !== undefined) {
    update.lastUid = result.cursorUpdate.lastUid;
  }
  if (result.cursorUpdate.lastSentUid !== undefined) {
    update.lastSentUid = result.cursorUpdate.lastSentUid;
  }

  await db
    .update(emailConnections)
    .set(update)
    .where(eq(emailConnections.id, connection.id));

  return processed;
}
