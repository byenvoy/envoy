import { db } from "@/lib/db";
import { conversations, organizations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { SUPPORTED_MODELS } from "@/lib/rag/llm";
import { generateDraftClassic } from "./generate-draft-classic";
import { generateDraftAgent } from "./generate-draft-agent";

/** What the pipeline decided for the latest inbound message. */
export type DraftOutcome = "drafted" | "escalated";

/**
 * Entry point for generating a draft reply to an inbound ticket.
 *
 * Routes by the organization's preferred LLM provider:
 *  - Anthropic → skill-driven agent pipeline (generate-draft-agent.ts)
 *  - Anything else → classic pipeline (generate-draft-classic.ts)
 *
 * Both paths produce the same shape of `drafts` and
 * `autopilot_evaluations` rows; downstream consumers (inbox UI,
 * auto-send, analytics) don't care which one ran.
 *
 * Returns the outcome so callers can persist conversations.draft_state.
 * Only the agent pipeline can escalate without drafting; the classic
 * pipeline always produces a draft when it succeeds.
 */
export async function generateDraftForConversation(
  conversationId: string,
  isRegeneration = false,
  userId?: string
): Promise<DraftOutcome> {
  const provider = await resolveProvider(conversationId);

  if (provider === "anthropic") {
    return generateDraftAgent(conversationId, isRegeneration, userId);
  }
  await generateDraftClassic(conversationId, isRegeneration);
  return "drafted";
}

/** Resolve the LLM provider for the conversation's org. Defaults to Anthropic. */
async function resolveProvider(conversationId: string): Promise<"anthropic" | "other"> {
  const row = await db
    .select({ preferredModel: organizations.preferredModel })
    .from(conversations)
    .innerJoin(organizations, eq(conversations.orgId, organizations.id))
    .where(eq(conversations.id, conversationId))
    .then((r) => r[0]);

  const modelId = row?.preferredModel ?? "claude-haiku-4-5-20251001";
  const provider = SUPPORTED_MODELS[modelId]?.provider;
  return provider === "anthropic" ? "anthropic" : "other";
}
