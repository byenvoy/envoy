import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { autopilotTopics } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { loadSkills } from "@/lib/skills/loader";
import { getOrgApiKey } from "@/lib/api-keys";
import { runAgentLoop } from "./loop";
import { generateDraft, type DraftResult } from "./draft";
import type { AgentContext, AgentAnalysis, RetrievedChunk } from "./types";
import type { ShopifyCustomerContext } from "@/lib/types/shopify";
import type { AutopilotTopicRow } from "@/lib/autopilot/types";

/**
 * Haiku for now — uniform model across analysis and draft phases.
 * Tiering (e.g. Haiku for triage + Sonnet for draft) can come later
 * once we have eval data to justify it.
 */
const AGENT_MODEL = "claude-haiku-4-5-20251001";

interface ConversationMessage {
  role: "customer" | "agent";
  content: string;
}

export interface AgentPipelineInput {
  orgId: string;
  conversationId: string;
  companyName: string;
  customerMessage: string;
  customerEmail: string;
  customerName: string | null;
  conversationHistory: ConversationMessage[];
  /** Per-thread escalation: if true, skip autopilot topic loading. */
  autopilotDisabled: boolean;
}

export interface AgentPipelineResult {
  analysis: AgentAnalysis | null;
  draft: DraftResult | null;
  chunks: RetrievedChunk[];
  customerContext: ShopifyCustomerContext | null;
  /** Topic row matched by the agent (if any) — used by the gate. */
  matchedTopic: AutopilotTopicRow | null;
  activeTopics: AutopilotTopicRow[];
  analysisUsage: { inputTokens: number; outputTokens: number };
  model: string;
}

/**
 * The skill-driven ticket processing pipeline.
 *
 * Phase 1: agent loop — triage, retrieval, autopilot verdict, escalation
 * via tools and skills. Terminates when submit_analysis is called.
 *
 * Phase 2: draft generation — separate Anthropic call with document
 * blocks for native citation support.
 *
 * Does NOT persist results or decide auto-send — those happen in the
 * caller (Phase 4 router).
 */
export async function runAgentPipeline(
  input: AgentPipelineInput
): Promise<AgentPipelineResult> {
  // Load active autopilot topics (skip if escalation already in place for the thread)
  const activeTopics: AutopilotTopicRow[] = input.autopilotDisabled
    ? []
    : await db
        .select()
        .from(autopilotTopics)
        .where(
          and(
            eq(autopilotTopics.orgId, input.orgId),
            inArray(autopilotTopics.mode, ["shadow", "auto"])
          )
        );

  // Load skill set (core + org overlays merged)
  const skills = await loadSkills(input.orgId);

  // Resolve org's Anthropic API key — the router upstream guarantees we
  // only run this pipeline when the org's preferredModel is Anthropic.
  const apiKey = await getOrgApiKey(input.orgId, "ANTHROPIC_API_KEY", {
    allowEnvFallback: false,
  });
  if (!apiKey) {
    throw new Error("No Anthropic API key configured for this organization");
  }

  const client = new Anthropic({ apiKey });

  // Phase 1: Agent loop (mutates ctx in place)
  const ctx: AgentContext = {
    orgId: input.orgId,
    conversationId: input.conversationId,
    customerEmail: input.customerEmail,
    customerName: input.customerName,
    retrievedChunks: [],
    customerContext: null,
    analysis: null,
    usage: { inputTokens: 0, outputTokens: 0 },
  };

  await runAgentLoop({
    client,
    model: AGENT_MODEL,
    skills,
    input: {
      companyName: input.companyName,
      customerMessage: input.customerMessage,
      customerEmail: input.customerEmail,
      customerName: input.customerName,
      conversationHistory: input.conversationHistory,
      activeTopics,
    },
    ctx,
  });

  // Resolve matched topic (if the agent picked one)
  const matchedTopic = ctx.analysis?.autopilotTopicId
    ? activeTopics.find((t) => t.id === ctx.analysis!.autopilotTopicId) ?? null
    : null;

  // Phase 2: draft generation (skip if escalated — no draft needed)
  let draft: DraftResult | null = null;
  if (ctx.analysis && !ctx.analysis.escalationFlag) {
    draft = await generateDraft({
      model: AGENT_MODEL,
      apiKey,
      companyName: input.companyName,
      customerMessage: input.customerMessage,
      customerName: input.customerName,
      conversationHistory: input.conversationHistory,
      chunks: ctx.retrievedChunks,
      customerContext: ctx.customerContext,
      analysis: ctx.analysis,
      skills,
    });
  }

  return {
    analysis: ctx.analysis,
    draft,
    chunks: ctx.retrievedChunks,
    customerContext: ctx.customerContext,
    matchedTopic,
    activeTopics,
    analysisUsage: ctx.usage,
    model: AGENT_MODEL,
  };
}
