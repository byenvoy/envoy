import { generateDraftClassic } from "./generate-draft-classic";

/**
 * Entry point for generating a draft reply to an inbound ticket.
 *
 * Currently delegates to the classic pipeline. A future commit will
 * introduce provider-gated routing: Anthropic orgs run through the
 * skill-driven agent pipeline; everything else continues to use the
 * classic path preserved in generate-draft-classic.ts.
 */
export async function generateDraftForConversation(
  conversationId: string,
  isRegeneration = false
): Promise<void> {
  await generateDraftClassic(conversationId, isRegeneration);
}
