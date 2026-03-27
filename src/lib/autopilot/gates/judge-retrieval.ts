import { createLLMProvider } from "@/lib/rag/llm";
import { logUsage } from "@/lib/usage/log";
import { buildRetrievalJudgePrompt } from "../prompts";
import type { RetrievalJudgmentResult } from "../types";
import type { ShopifyCustomerContext } from "@/lib/types/shopify";

const RETRIEVAL_CONFIDENCE_THRESHOLD = 0.8;

/**
 * Gate 2: Retrieval Quality Check
 *
 * LLM-as-judge evaluating whether retrieved KB chunks + customer context
 * contain sufficient information to answer the customer's question.
 */
export async function judgeRetrievalQuality({
  customerMessage,
  chunks,
  customerContext,
  model,
  orgId,
}: {
  customerMessage: string;
  chunks: { content: string; similarity: number }[];
  customerContext: ShopifyCustomerContext | null;
  model: string;
  orgId: string;
}): Promise<RetrievalJudgmentResult> {
  if (chunks.length === 0) {
    return {
      passed: false,
      confidence: 0,
      reasoning: "No knowledge base chunks retrieved",
    };
  }

  const customerContextStr = customerContext
    ? JSON.stringify(customerContext, null, 2)
    : null;

  const { system, user } = buildRetrievalJudgePrompt(
    customerMessage,
    chunks.map((c) => c.content),
    customerContextStr
  );

  try {
    const llm = await createLLMProvider(model, orgId);
    const response = await llm.generateDraft(system, user);

    await logUsage({
      orgId,
      callType: "autopilot_retrieval_judge",
      model: response.model,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
    });

    const cleaned = response.text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    const confidence = parsed.confidence ?? 0;
    const reasoning = parsed.reasoning ?? "";

    return {
      passed: confidence >= RETRIEVAL_CONFIDENCE_THRESHOLD,
      confidence,
      reasoning,
    };
  } catch (error) {
    console.error("Gate 2 (retrieval judge) failed:", error);
    return {
      passed: false,
      confidence: 0,
      reasoning: "Retrieval quality check failed",
    };
  }
}
