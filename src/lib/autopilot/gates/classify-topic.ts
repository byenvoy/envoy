import { createLLMProvider } from "@/lib/rag/llm";
import { logUsage } from "@/lib/usage/log";
import { buildTopicClassificationPrompt } from "../prompts";
import type { AutopilotTopic, TopicClassificationResult } from "../types";

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
  topics: AutopilotTopic[];
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

    const topicIndex = parsed.topic_index ?? 0;
    const confidence = parsed.confidence ?? 0;
    const reasoning = parsed.reasoning ?? "";

    if (topicIndex === 0 || topicIndex > topics.length) {
      return {
        passed: false,
        topicId: null,
        topicName: parsed.topic_name ?? "none",
        confidence,
        embeddingSimilarity: null,
        reasoning,
      };
    }

    const matchedTopic = topics[topicIndex - 1];
    const passed = confidence >= matchedTopic.confidence_threshold;

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
