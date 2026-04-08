import { db } from "@/lib/db";
import {
  conversations,
  messages,
  drafts,
  autopilotTopics,
  organizations,
} from "@/lib/db/schema";
import { eq, and, asc, inArray } from "drizzle-orm";
import { retrieveAndDraft } from "@/lib/rag/retrieve";
import { runAutopilotPipeline } from "@/lib/autopilot/pipeline";
import { autoSendDraft } from "@/lib/autopilot/auto-send";
import { classifyTopic } from "@/lib/autopilot/gates/classify-topic";
import { isCloud } from "@/lib/config";
import { recordLLMError, clearLLMError } from "@/lib/rag/llm-errors";
import type { TopicClassificationResult, AutopilotTopicRow } from "@/lib/autopilot/types";

export async function generateDraftForConversation(conversationId: string, isRegeneration = false): Promise<void> {
  // Fetch conversation with org name
  const conversation = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .then((r) => r[0]);

  if (!conversation) throw new Error("Conversation not found");

  const org = await db
    .select({ name: organizations.name, preferredModel: organizations.preferredModel })
    .from(organizations)
    .where(eq(organizations.id, conversation.orgId))
    .then((r) => r[0]);

  // Fetch all messages in the conversation, ordered chronologically
  const allMessages = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt));

  if (allMessages.length === 0) throw new Error("No messages in conversation");

  // Build conversation history from all messages except the latest inbound
  const latestMessage = allMessages[allMessages.length - 1];
  const priorMessages = allMessages.slice(0, -1);

  const conversationHistory: { role: "customer" | "agent"; content: string }[] = [];
  for (const msg of priorMessages) {
    if (msg.bodyText) {
      conversationHistory.push({
        role: msg.direction === "inbound" ? "customer" : "agent",
        content: msg.bodyText,
      });
    }
  }

  const companyName = org?.name ?? "Our Company";
  const customerMessage = latestMessage.bodyText ?? conversation.subject ?? "";

  // Run Gate 1 (topic classification) before draft generation
  let gate1Result: TopicClassificationResult | null = null;
  let activeTopicsList: AutopilotTopicRow[] = [];

  // Check if conversation has autopilot disabled (per-thread escalation)
  const isEscalated = conversation.autopilotDisabled === true;

  if (!isEscalated) {
    const topics = await db
      .select()
      .from(autopilotTopics)
      .where(
        and(
          eq(autopilotTopics.orgId, conversation.orgId),
          inArray(autopilotTopics.mode, ["shadow", "auto"])
        )
      );

    activeTopicsList = topics;

    if (activeTopicsList.length > 0) {
      try {
        gate1Result = await classifyTopic({
          customerMessage,
          conversationHistory: conversationHistory.length > 0 ? conversationHistory : undefined,
          topics: activeTopicsList,
          model: isCloud() ? "claude-haiku-4-5-20251001" : (org?.preferredModel ?? "claude-haiku-4-5-20251001"),
          orgId: conversation.orgId,
        });
      } catch (error) {
        console.error("Gate 1 classification failed:", error);
      }
    }
  }

  let result;
  try {
    result = await retrieveAndDraft({
      orgId: conversation.orgId,
      companyName,
      customerMessage,
      customerEmail: conversation.customerEmail,
      conversationHistory: conversationHistory.length > 0 ? conversationHistory : undefined,
      customerName: conversation.customerName,
      injectConstrainedPrompt: gate1Result?.passed === true,
    });
    // Clear any previous LLM error on success
    await clearLLMError(conversation.orgId);
  } catch (error) {
    const classified = await recordLLMError(conversation.orgId, error);
    console.error(`Draft generation failed (${classified.type}):`, error);
    throw error;
  }

  // Strip NEEDS_HUMAN_REVIEW flag from draft content if present.
  const cleanedDraft = result.draft.replace(/\n?\*{0,2}NEEDS_HUMAN_REVIEW\*{0,2}:.*$/m, "").trim();

  // Insert draft and get its ID
  const insertedDraft = await db
    .insert(drafts)
    .values({
      conversationId,
      orgId: conversation.orgId,
      draftContent: cleanedDraft,
      modelUsed: result.model,
      chunksUsed: result.chunks.map((c) => ({
        id: c.id,
        content: c.content,
        similarity: c.similarity,
        source_url: c.source_url,
      })),
      customerContext: result.customerContext ?? null,
      classificationResult: result.classification ?? null,
      isRegeneration,
    })
    .returning({ id: drafts.id })
    .then((r) => r[0]);

  if (!insertedDraft) throw new Error("Failed to insert draft");

  // Run autopilot pipeline
  try {
    const autopilotResult = await runAutopilotPipeline({
      orgId: conversation.orgId,
      conversationId,
      draftId: insertedDraft.id,
      customerMessage,
      conversationHistory: conversationHistory.length > 0 ? conversationHistory : undefined,
      draftContent: result.draft,
      messageEmbedding: result.messageEmbedding,
      chunks: result.chunks,
      customerContext: result.customerContext,
      model: result.model,
      gate1Result: gate1Result ?? undefined,
      activeTopics: activeTopicsList,
    });

    if (autopilotResult) {
      // Tag the draft with the evaluation
      await db
        .update(drafts)
        .set({
          autopilotEvaluationId: autopilotResult.evaluationId || null,
          sentByAutopilot: autopilotResult.shouldAutoSend,
        })
        .where(eq(drafts.id, insertedDraft.id));

      // Auto-send if all gates passed, mode is auto, and no LLM errors on the org
      if (autopilotResult.shouldAutoSend && autopilotResult.topicMatch) {
        const orgCheck = await db
          .select({ llmErrorMessage: organizations.llmErrorMessage })
          .from(organizations)
          .where(eq(organizations.id, conversation.orgId))
          .then((r) => r[0]);

        if (orgCheck?.llmErrorMessage) {
          console.warn(`[autopilot] Skipping auto-send for ${conversationId}: LLM error on org`);
          return;
        }
        await autoSendDraft({
          conversationId,
          draftId: insertedDraft.id,
          draftContent: result.draft,
          orgId: conversation.orgId,
          topicId: autopilotResult.topicMatch.id,
        });
      }
    }
  } catch (error) {
    // Autopilot failure should never prevent draft creation
    console.error("Autopilot pipeline error (draft still created):", error);
  }
}
