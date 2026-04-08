import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export type LLMErrorType = "auth" | "quota" | "rate_limit" | "transient";

interface ClassifiedError {
  type: LLMErrorType;
  message: string;
  retryable: boolean;
}

/**
 * Classify an LLM provider error into a category for user-facing messaging.
 */
export function classifyLLMError(error: unknown): ClassifiedError {
  const msg = error instanceof Error ? error.message : String(error);
  const lower = msg.toLowerCase();

  // Auth errors (invalid/revoked API key)
  if (
    lower.includes("invalid api key") ||
    lower.includes("invalid x-api-key") ||
    lower.includes("incorrect api key") ||
    lower.includes("authentication") ||
    lower.includes("unauthorized") ||
    lower.includes("permission denied") ||
    lower.includes("invalid_api_key")
  ) {
    return {
      type: "auth",
      message: "Your API key is invalid or has been revoked. Check your API key in Settings.",
      retryable: false,
    };
  }

  // Quota / credit exhaustion
  if (
    lower.includes("insufficient") ||
    lower.includes("quota") ||
    lower.includes("billing") ||
    lower.includes("exceeded") && lower.includes("limit") ||
    lower.includes("credit") ||
    lower.includes("payment required") ||
    lower.includes("budget") ||
    lower.includes("insufficient_quota") ||
    lower.includes("rate_limit_exceeded") && lower.includes("quota")
  ) {
    return {
      type: "quota",
      message: "Your API key has run out of credits. Add funds with your LLM provider and try again.",
      retryable: false,
    };
  }

  // Rate limits (transient, but worth surfacing)
  if (
    lower.includes("rate limit") ||
    lower.includes("rate_limit") ||
    lower.includes("too many requests") ||
    lower.includes("429")
  ) {
    return {
      type: "rate_limit",
      message: "Rate limited by your LLM provider. Drafts will resume automatically.",
      retryable: true,
    };
  }

  // Everything else is transient
  return {
    type: "transient",
    message: "Draft generation temporarily failed. Will retry on next poll.",
    retryable: true,
  };
}

/**
 * Record an LLM error on the organization so it can be surfaced in the UI.
 * Only persists non-retryable errors (auth, quota). Transient errors are not stored.
 */
export async function recordLLMError(orgId: string, error: unknown): Promise<ClassifiedError> {
  const classified = classifyLLMError(error);

  if (!classified.retryable) {
    await db
      .update(organizations)
      .set({
        llmErrorMessage: classified.message,
        llmErrorAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, orgId));
  }

  return classified;
}

/**
 * Clear the LLM error on an organization after a successful call.
 */
export async function clearLLMError(orgId: string): Promise<void> {
  await db
    .update(organizations)
    .set({
      llmErrorMessage: null,
      llmErrorAt: null,
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, orgId));
}
