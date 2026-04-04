import { createLLMProvider } from "@/lib/rag/llm";
import { logUsage } from "@/lib/usage/log";
import { buildTopicClassificationPrompt } from "../prompts";
import type { TopicClassificationResult, AutopilotTopicRow } from "../types";

/**
 * Gate 1: Topic Classification
 *
 * 1. Compute embedding similarity (logged, not used as filter)
 * 2. LLM classification against user-defined topics
 * 3. Pass if confidence > topic's confidence_threshold
 */
export async function classifyTopic({
  customerMessage,
  conversationHistory,
  topics,
  model,
  orgId,
}: {
  customerMessage: string;
  conversationHistory?: { role: "customer" | "agent"; content: string }[];
  topics: AutopilotTopicRow[];
  model: string;
  orgId: string;
}): Promise<TopicClassificationResult> {
  // LLM classification
  const { system, user } = buildTopicClassificationPrompt(topics, customerMessage, conversationHistory);

  try {
    const llm = await createLLMProvider(model, orgId);
    const response = await llm.generateDraft(system, user);

    await logUsage({
      orgId,
      callType: "autopilot_classify",
      model: response.model,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
    });

    const cleaned = response.text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    const topicName = parsed.topic_name ?? "none";
    const confidence = parsed.confidence ?? 0;
    const reasoning = parsed.reasoning ?? "";

    const matchedTopic = topicName !== "none"
      ? topics.find((t) => t.name === topicName)
      : undefined;

    if (!matchedTopic) {
      return {
        passed: false,
        topicId: null,
        topicName,
        confidence,
        embeddingSimilarity: null,
        reasoning,
      };
    }

    const passed = confidence >= Number(matchedTopic.confidenceThreshold);

    return {
      passed,
      topicId: matchedTopic.id,
      topicName: matchedTopic.name,
      confidence,
      embeddingSimilarity: null,
      reasoning,
    };
  } catch (error) {
    console.error("Gate 1 (topic classification) failed:", error);
    return {
      passed: false,
      topicId: null,
      topicName: null,
      confidence: 0,
      embeddingSimilarity: null,
      reasoning: "Classification failed",
    };
  }
}
