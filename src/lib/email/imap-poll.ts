import { db } from "@/lib/db";
import { emailConnections, conversations, messages, drafts } from "@/lib/db/schema";
import { eq, and, desc, isNull, gte, inArray } from "drizzle-orm";
import { processImapEmail } from "./process-imap";
import { processSentEmail } from "./process-sent";
import { generateDraftForConversation } from "./generate-draft";
import { checkAndEscalateThread } from "@/lib/autopilot/escalation";
import { getTransport } from "./transports";

type EmailConnectionRow = typeof emailConnections.$inferSelect;

const STUCK_RETRY_LOOKBACK_MS = 24 * 60 * 60 * 1000;
const STUCK_RETRY_LIMIT_PER_POLL = 5;

type DraftState = "generating" | "drafted" | "escalated" | "skipped" | "failed";

/** Record the pipeline's decision for the conversation's latest message. */
async function setDraftState(conversationId: string, state: DraftState): Promise<void> {
  await db
    .update(conversations)
    .set({ draftState: state, updatedAt: new Date() })
    .where(eq(conversations.id, conversationId));
}

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
      .select({
        direction: messages.direction,
        bodyText: messages.bodyText,
        isAutomated: messages.isAutomated,
      })
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

    // Skip marketing / automated mail — drafting a reply is not useful and
    // these emails (long marketing HTML, mailing lists) trip RAG embedding limits.
    if (lastMsg.isAutomated) {
      await setDraftState(conversationId, "skipped");
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

    if (existingDraft) {
      await setDraftState(conversationId, "drafted");
      continue;
    }

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

    try {
      const outcome = await generateDraftForConversation(conversationId);
      await setDraftState(conversationId, outcome);
    } catch (err) {
      // Per-conversation isolation: a single draft failure must not block
      // the rest of the loop or fail the poll. recordLLMError inside
      // generateDraftForConversation already surfaces non-retryable errors
      // (auth/quota) via the org-level llmErrorMessage banner.
      console.error(`Draft generation failed for conversation ${conversationId}:`, err);
      await setDraftState(conversationId, "failed").catch(() => {});
    }
  }

  // --- Phase 2.5: Retry recently-stuck conversations ---
  // Conversations whose pipeline never reached a decision ('generating' —
  // e.g. an earlier poll crashed mid-run) or failed outright. Escalated /
  // skipped / drafted states are decisions and are not retried. Bounded by
  // a 24h window so genuinely failing-forever conversations age out.
  const stuckCutoff = new Date(Date.now() - STUCK_RETRY_LOOKBACK_MS);
  const stuckCandidates = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(
      and(
        eq(conversations.orgId, connection.orgId),
        gte(conversations.lastMessageAt, stuckCutoff),
        inArray(conversations.draftState, ["generating", "failed"])
      )
    )
    .orderBy(desc(conversations.lastMessageAt))
    .limit(STUCK_RETRY_LIMIT_PER_POLL);

  for (const { id: stuckId } of stuckCandidates) {
    if (touchedConversationIds.has(stuckId)) continue;

    const lastMsg = await db
      .select({ direction: messages.direction, isAutomated: messages.isAutomated })
      .from(messages)
      .where(eq(messages.conversationId, stuckId))
      .orderBy(desc(messages.createdAt))
      .limit(1)
      .then((r) => r[0]);

    if (lastMsg?.direction !== "inbound") continue;
    if (lastMsg.isAutomated) continue;

    try {
      const outcome = await generateDraftForConversation(stuckId);
      await setDraftState(stuckId, outcome);
    } catch (err) {
      console.error(`Stuck-conversation draft retry failed for ${stuckId}:`, err);
      await setDraftState(stuckId, "failed").catch(() => {});
    }
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
