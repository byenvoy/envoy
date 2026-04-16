import Anthropic from "@anthropic-ai/sdk";

/**
 * Minimal Anthropic client for the eval harness.
 *
 * Deliberately bypasses src/lib/rag/llm.ts because that path requires an
 * orgId to look up per-tenant API keys from the database. Evals run against
 * the server's own ANTHROPIC_API_KEY from .env.local — no DB, no auth.
 *
 * We use temperature=0 where supported to reduce run-to-run variance.
 */
const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface LLMResponse {
  text: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
}

export async function callAnthropic({
  model,
  system,
  user,
  maxTokens = 2048,
}: {
  model: string;
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<LLMResponse> {
  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    temperature: 0,
    system,
    messages: [{ role: "user", content: user }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error(`No text block in response for model ${model}`);
  }

  return {
    text: textBlock.text,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    model: response.model,
  };
}

/** Strip markdown code fences if the model wrapped its JSON despite being told not to. */
export function parseJsonResponse<T>(text: string): T {
  const cleaned = text
    .replace(/```json\s*/g, "")
    .replace(/```\s*/g, "")
    .trim();
  return JSON.parse(cleaned) as T;
}
