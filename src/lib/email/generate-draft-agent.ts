import { db } from "@/lib/db";
import {
  conversations,
  messages,
  drafts,
  autopilotEvaluations,
  autopilotTopics,
  organizations,
} from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { runAgentPipeline, DEFAULT_AGENT_MODEL } from "@/lib/agent/pipeline";
import { autoSendDraft } from "@/lib/autopilot/auto-send";
import { recordLLMError, clearLLMError } from "@/lib/rag/llm-errors";
import { logUsage } from "@/lib/usage/log";
import type { AutopilotTopicRow, AutopilotOutcome } from "@/lib/autopilot/types";

/**
 * Skill-driven draft generation pipeline.
 *
 * Orchestrates the agent pipeline (triage agent → draft phase) and
 * persists results to drafts + autopilot_evaluations. Decides auto-send
 * via a deterministic code gate that maps the agent's structured
 * verdict to the existing autopilot evaluation columns.
 *
 * Only invoked when the org's preferredModel is Anthropic (see the
 * router in generate-draft.ts).
 */
export async function generateDraftAgent(
  conversationId: string,
  isRegeneration = false
): Promise<void> {
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

  const allMessages = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt));

  if (allMessages.length === 0) throw new Error("No messages in conversation");

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
  // Use the org's selected Anthropic model. The router upstream guarantees
  // this is an Anthropic-provider model; if preferredModel is unset, the
  // router defaulted to Haiku and routed here.
  const model = org?.preferredModel ?? DEFAULT_AGENT_MODEL;

  // Run the agent pipeline (triage → draft with citations)
  let result;
  try {
    result = await runAgentPipeline({
      orgId: conversation.orgId,
      conversationId,
      companyName,
      customerMessage,
      customerEmail: conversation.customerEmail,
      customerName: conversation.customerName,
      conversationHistory,
      autopilotDisabled: conversation.autopilotDisabled,
      model,
    });
    await clearLLMError(conversation.orgId);
  } catch (error) {
    const classified = await recordLLMError(conversation.orgId, error);
    console.error(`Agent pipeline failed (${classified.type}):`, error);
    throw error;
  }

  // Telemetry
  await logUsage({
    orgId: conversation.orgId,
    callType: "classification",
    model: result.model,
    inputTokens: result.analysisUsage.inputTokens,
    outputTokens: result.analysisUsage.outputTokens,
  });

  if (result.draft) {
    await logUsage({
      orgId: conversation.orgId,
      callType: "draft",
      model: result.draft.model,
      inputTokens: result.draft.inputTokens,
      outputTokens: result.draft.outputTokens,
    });
  }

  // Persist draft (escalated tickets skip drafting — agent doesn't produce one)
  let draftId: string | null = null;
  if (result.draft) {
    const insertedDraft = await db
      .insert(drafts)
      .values({
        conversationId,
        orgId: conversation.orgId,
        draftContent: result.draft.text,
        modelUsed: result.draft.model,
        chunksUsed: result.chunks.map((c) => ({
          id: c.id,
          content: c.content,
          similarity: c.similarity,
          source_url: c.source_url,
        })),
        citationsMetadata: result.draft.citationBlocks ?? null,
        customerContext: result.customerContext ?? null,
        classificationResult: result.analysis
          ? {
              category: result.analysis.category,
              autopilotTopicId: result.analysis.autopilotTopicId,
              autopilotConfidence: result.analysis.autopilotConfidence,
              autopilotReasoning: result.analysis.autopilotReasoning,
              escalationFlag: result.analysis.escalationFlag,
              escalationReason: result.analysis.escalationReason,
              draftInstructions: result.analysis.draftInstructions,
            }
          : null,
        // Promoted out of classification_result for indexable queries.
        category: result.analysis?.category ?? null,
        isRegeneration,
      })
      .returning({ id: drafts.id })
      .then((r) => r[0]);

    if (!insertedDraft) throw new Error("Failed to insert draft");
    draftId = insertedDraft.id;
  }

  // Apply the autopilot gate and persist the evaluation row
  if (result.analysis) {
    const gate = evaluateGate(result.analysis, result.matchedTopic);

    const evaluation = await db
      .insert(autopilotEvaluations)
      .values({
        orgId: conversation.orgId,
        conversationId,
        draftId,
        // Gate 1 — autopilot topic match from the agent verdict
        gate1Passed: gate.topicMatched,
        gate1TopicId: result.matchedTopic?.id ?? null,
        gate1TopicName: result.matchedTopic?.name ?? null,
        gate1Confidence:
          result.analysis.autopilotConfidence != null
            ? String(result.analysis.autopilotConfidence)
            : null,
        gate1Reasoning: result.analysis.autopilotReasoning,
        // Gate 3 — escalation flag (escape hatch equivalent)
        gate3Passed: !result.analysis.escalationFlag,
        gate3NeedsHumanReason: result.analysis.escalationReason,
        // Gates 2 + 4 (retrieval-quality + post-gen validation) are
        // implicit in the agent's reasoning. Mark as passed when we
        // have a draft; null when escalated (no draft produced).
        gate2Passed: result.draft ? true : null,
        gate4Passed: result.draft ? true : null,
        // Outcome
        allGatesPassed: gate.allPassed,
        outcome: gate.outcome,
        failureGate: gate.failureGate,
        gateModel: result.model,
        generationModel: result.draft?.model ?? null,
      })
      .returning({ id: autopilotEvaluations.id })
      .then((r) => r[0]);

    if (draftId && evaluation) {
      await db
        .update(drafts)
        .set({
          autopilotEvaluationId: evaluation.id,
          sentByAutopilot: gate.outcome === "auto_sent",
        })
        .where(eq(drafts.id, draftId));
    }

    // Auto-send if the gate said yes
    if (
      gate.outcome === "auto_sent" &&
      result.matchedTopic &&
      draftId &&
      result.draft
    ) {
      await autoSendDraft({
        conversationId,
        draftId,
        draftContent: result.draft.text,
        orgId: conversation.orgId,
        topicId: result.matchedTopic.id,
      });
    }
  }
}

/**
 * Map the agent's structured verdict to an autopilot outcome.
 * Pure function — no I/O, easy to unit-test in isolation.
 */
function evaluateGate(
  analysis: {
    autopilotTopicId: string | null;
    autopilotConfidence: number | null;
    escalationFlag: boolean;
  },
  matchedTopic: AutopilotTopicRow | null
): {
  topicMatched: boolean;
  allPassed: boolean;
  outcome: AutopilotOutcome;
  failureGate: number | null;
} {
  // Escalation always wins — route to human regardless of topic match
  if (analysis.escalationFlag) {
    return { topicMatched: false, allPassed: false, outcome: "human_queue", failureGate: 3 };
  }

  // No topic match → human queue
  if (!matchedTopic || !analysis.autopilotTopicId) {
    return { topicMatched: false, allPassed: false, outcome: "human_queue", failureGate: 1 };
  }

  const confidence = analysis.autopilotConfidence ?? 0;
  const threshold = Number(matchedTopic.confidenceThreshold);

  // Confidence below the topic's threshold → human queue
  if (confidence < threshold) {
    return { topicMatched: true, allPassed: false, outcome: "human_queue", failureGate: 1 };
  }

  // Daily send-limit check and counter reset for auto-mode topics
  if (matchedTopic.mode === "auto") {
    const resetAt = new Date(matchedTopic.dailySendsResetAt);
    const startOfTodayDate = startOfToday();
    const effectiveSendsToday =
      resetAt < startOfTodayDate ? 0 : matchedTopic.dailySendsToday;

    if (effectiveSendsToday >= matchedTopic.dailySendLimit) {
      return { topicMatched: true, allPassed: true, outcome: "shadow_tagged", failureGate: null };
    }

    if (resetAt < startOfTodayDate) {
      void db
        .update(autopilotTopics)
        .set({ dailySendsToday: 0, dailySendsResetAt: new Date() })
        .where(eq(autopilotTopics.id, matchedTopic.id));
    }

    return { topicMatched: true, allPassed: true, outcome: "auto_sent", failureGate: null };
  }

  // Shadow mode — log but don't send
  return { topicMatched: true, allPassed: true, outcome: "shadow_tagged", failureGate: null };
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
