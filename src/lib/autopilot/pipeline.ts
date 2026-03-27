import type { SupabaseClient } from "@supabase/supabase-js";
import { judgeRetrievalQuality } from "./gates/judge-retrieval";
import { validateDraft } from "./gates/validate-draft";
import type {
  AutopilotPipelineParams,
  AutopilotPipelineResult,
  TopicClassificationResult,
  RetrievalJudgmentResult,
  ValidationResult,
} from "./types";
import type { AutopilotTopic, AutopilotOutcome } from "@/lib/types/database";

// Match NEEDS_HUMAN_REVIEW flag — tolerant of markdown formatting, extra whitespace
const NEEDS_HUMAN_REVIEW_PATTERN = /\*{0,2}NEEDS_HUMAN_REVIEW\*{0,2}:\s*(.+)$/m;

/** Compute cosine similarity between two vectors. */
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Run the four-gate autopilot pipeline on a generated draft.
 * Returns the evaluation result and whether to auto-send.
 */
export async function runAutopilotPipeline(
  supabase: SupabaseClient,
  params: AutopilotPipelineParams
): Promise<AutopilotPipelineResult | null> {
  const {
    orgId,
    conversationId,
    draftId,
    customerMessage,
    draftContent,
    messageEmbedding,
    chunks,
    customerContext,
    gate1Result: precomputedGate1,
    activeTopics: precomputedTopics,
  } = params;

  // Gate 1 was already run in generate-draft.ts before draft generation.
  // If no result or no active topics were passed, nothing to evaluate.
  if (!precomputedGate1 || !precomputedTopics || precomputedTopics.length === 0) return null;

  const activeTopics = precomputedTopics;

  // Use Haiku for gate calls (cheap + fast)
  const gateModel = "claude-haiku-4-5-20251001";

  // Track gate results for the evaluation row
  let gate1Result: TopicClassificationResult = precomputedGate1;
  let gate2Result: RetrievalJudgmentResult | null = null;
  let gate3Passed: boolean | null = null;
  let gate3Reason: string | null = null;
  let gate4Result: ValidationResult | null = null;
  let failureGate: number | null = null;
  let matchedTopic: AutopilotTopic | null = null;

  // Compute embedding similarity for logging (using the embedding from the vector search)
  if (messageEmbedding && gate1Result.topicId) {
    const topic = activeTopics.find((t) => t.id === gate1Result.topicId);
    if (topic?.embedding) {
      gate1Result = {
        ...gate1Result,
        embeddingSimilarity: cosineSimilarity(messageEmbedding, topic.embedding),
      };
    }
  }

  if (!gate1Result.passed) {
    failureGate = 1;
    return await insertEvaluation(supabase, {
      orgId, conversationId, draftId, failureGate,
      gate1Result, gate2Result, gate3Passed, gate3Reason, gate4Result,
      outcome: "human_queue", allGatesPassed: false,
    });
  }

  matchedTopic = activeTopics.find((t) => t.id === gate1Result!.topicId) ?? null;

  // --- Gate 2: Retrieval Quality ---
  gate2Result = await judgeRetrievalQuality({
    customerMessage,
    chunks,
    customerContext,
    model: gateModel,
    orgId,
  });

  if (!gate2Result.passed) {
    failureGate = 2;
    return await insertEvaluation(supabase, {
      orgId, conversationId, draftId, failureGate,
      gate1Result, gate2Result, gate3Passed, gate3Reason, gate4Result,
      outcome: "human_queue", allGatesPassed: false,
    });
  }

  // --- Gate 3: Generation Escape Hatch ---
  const humanReviewMatch = draftContent.match(NEEDS_HUMAN_REVIEW_PATTERN);
  gate3Passed = !humanReviewMatch;
  gate3Reason = humanReviewMatch ? humanReviewMatch[1] : null;

  if (!gate3Passed) {
    failureGate = 3;
    return await insertEvaluation(supabase, {
      orgId, conversationId, draftId, failureGate,
      gate1Result, gate2Result, gate3Passed, gate3Reason, gate4Result,
      outcome: "human_queue", allGatesPassed: false,
    });
  }

  // --- Gate 4: Post-Generation Validation ---
  gate4Result = await validateDraft({
    customerMessage,
    draftContent,
    chunks,
    customerContext,
    model: gateModel,
    orgId,
  });

  if (!gate4Result.passed) {
    failureGate = 4;
    return await insertEvaluation(supabase, {
      orgId, conversationId, draftId, failureGate,
      gate1Result, gate2Result, gate3Passed, gate3Reason, gate4Result,
      outcome: "human_queue", allGatesPassed: false,
    });
  }

  // --- All gates passed ---

  // Check daily send limit (only matters for auto mode)
  const topicMode = matchedTopic?.mode ?? "shadow";
  let outcome: AutopilotOutcome;

  if (topicMode === "auto") {
    // Reset daily count if needed
    if (matchedTopic && new Date(matchedTopic.daily_sends_reset_at) < startOfToday()) {
      await supabase
        .from("autopilot_topics")
        .update({ daily_sends_today: 0, daily_sends_reset_at: new Date().toISOString() })
        .eq("id", matchedTopic.id);
      matchedTopic.daily_sends_today = 0;
    }

    if (matchedTopic && matchedTopic.daily_sends_today >= matchedTopic.daily_send_limit) {
      // Limit exceeded — treat as shadow
      outcome = "shadow_tagged";
    } else {
      outcome = "auto_sent";
    }
  } else {
    outcome = "shadow_tagged";
  }

  return await insertEvaluation(supabase, {
    orgId, conversationId, draftId, failureGate: null,
    gate1Result, gate2Result, gate3Passed, gate3Reason, gate4Result,
    outcome, allGatesPassed: true,
  });
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

interface InsertEvaluationParams {
  orgId: string;
  conversationId: string;
  draftId: string;
  failureGate: number | null;
  gate1Result: TopicClassificationResult | null;
  gate2Result: RetrievalJudgmentResult | null;
  gate3Passed: boolean | null;
  gate3Reason: string | null;
  gate4Result: ValidationResult | null;
  outcome: AutopilotOutcome;
  allGatesPassed: boolean;
}

async function insertEvaluation(
  supabase: SupabaseClient,
  p: InsertEvaluationParams
): Promise<AutopilotPipelineResult> {
  const { data: evaluation, error } = await supabase
    .from("autopilot_evaluations")
    .insert({
      org_id: p.orgId,
      conversation_id: p.conversationId,
      draft_id: p.draftId,
      gate1_passed: p.gate1Result?.passed ?? null,
      gate1_topic_id: p.gate1Result?.topicId ?? null,
      gate1_topic_name: p.gate1Result?.topicName ?? null,
      gate1_confidence: p.gate1Result?.confidence ?? null,
      gate1_embedding_similarity: p.gate1Result?.embeddingSimilarity ?? null,
      gate1_reasoning: p.gate1Result?.reasoning ?? null,
      gate2_passed: p.gate2Result?.passed ?? null,
      gate2_confidence: p.gate2Result?.confidence ?? null,
      gate2_reasoning: p.gate2Result?.reasoning ?? null,
      gate3_passed: p.gate3Passed,
      gate3_needs_human_reason: p.gate3Reason,
      gate4_passed: p.gate4Result?.passed ?? null,
      gate4_confidence: p.gate4Result?.confidence ?? null,
      gate4_checks: p.gate4Result?.checks ?? null,
      gate4_reasoning: p.gate4Result?.reasoning ?? null,
      all_gates_passed: p.allGatesPassed,
      outcome: p.outcome,
      failure_gate: p.failureGate,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Failed to insert autopilot evaluation:", error);
    // Return a safe fallback — route to human queue
    return {
      shouldAutoSend: false,
      isShadow: false,
      evaluationId: "",
      failureGate: p.failureGate,
      outcome: "human_queue",
      topicMatch: null,
    };
  }

  return {
    shouldAutoSend: p.outcome === "auto_sent",
    isShadow: p.outcome === "shadow_tagged",
    evaluationId: evaluation.id,
    failureGate: p.failureGate,
    outcome: p.outcome,
    topicMatch: p.gate1Result?.topicId
      ? {
          id: p.gate1Result.topicId,
          name: p.gate1Result.topicName ?? "",
          confidence: p.gate1Result.confidence,
        }
      : null,
  };
}
