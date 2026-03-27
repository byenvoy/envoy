import { createLLMProvider } from "@/lib/rag/llm";
import { logUsage } from "@/lib/usage/log";
import { buildValidationPrompt } from "../prompts";
import type { ValidationResult } from "../types";
import type { ShopifyCustomerContext } from "@/lib/types/shopify";

const VALIDATION_CONFIDENCE_THRESHOLD = 0.85;

/**
 * Gate 4: Post-Generation Validation
 *
 * Separate LLM call (critic, not generator) evaluating the draft
 * for responsiveness, accuracy, scope, tone, and completeness.
 */
export async function validateDraft({
  customerMessage,
  draftContent,
  chunks,
  customerContext,
  model,
  orgId,
}: {
  customerMessage: string;
  draftContent: string;
  chunks: { content: string }[];
  customerContext: ShopifyCustomerContext | null;
  model: string;
  orgId: string;
}): Promise<ValidationResult> {
  const customerContextStr = customerContext
    ? JSON.stringify(customerContext, null, 2)
    : null;

  const { system, user } = buildValidationPrompt(
    customerMessage,
    draftContent,
    chunks.map((c) => c.content),
    customerContextStr
  );

  const defaultChecks = {
    responsiveness: { pass: false, note: "Validation failed" },
    accuracy: { pass: false, note: "Validation failed" },
    scope: { pass: false, note: "Validation failed" },
    completeness: { pass: false, note: "Validation failed" },
  };

  try {
    const llm = await createLLMProvider(model, orgId);
    const response = await llm.generateDraft(system, user);

    await logUsage({
      orgId,
      callType: "autopilot_validate",
      model: response.model,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
    });

    const cleaned = response.text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    const checks = {
      responsiveness: parsed.checks?.responsiveness ?? defaultChecks.responsiveness,
      accuracy: parsed.checks?.accuracy ?? defaultChecks.accuracy,
      scope: parsed.checks?.scope ?? defaultChecks.scope,
      completeness: parsed.checks?.completeness ?? defaultChecks.completeness,
    };

    const confidence = parsed.confidence ?? 0;
    const reasoning = parsed.reasoning ?? "";

    const allChecksPassed = Object.values(checks).every((c) => c.pass);
    const passed = allChecksPassed && confidence >= VALIDATION_CONFIDENCE_THRESHOLD;

    return { passed, confidence, checks, reasoning };
  } catch (error) {
    console.error("Gate 4 (validation) failed:", error);
    return {
      passed: false,
      confidence: 0,
      checks: defaultChecks,
      reasoning: "Validation failed",
    };
  }
}
