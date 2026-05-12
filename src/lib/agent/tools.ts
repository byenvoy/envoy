import type Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { knowledgeBasePages } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";
import { matchChunks } from "@/lib/db/helpers";
import { embedText } from "@/lib/rag/embeddings";
import { createShopifyClient } from "@/lib/integrations/shopify-client-factory";
import { findSkill } from "@/lib/skills/loader";
import type { Skill } from "@/lib/skills/types";
import type { AgentContext, AgentAnalysis, RetrievedChunk } from "./types";

/**
 * Tool schemas advertised to the model. Descriptions matter — the model
 * reads them upfront and decides when each tool is appropriate.
 */
export const AGENT_TOOLS: Anthropic.Tool[] = [
  {
    name: "read_skill",
    description:
      "Load the full body of a skill you've seen in the skills list. " +
      "Use this when you need the detailed instructions before acting on a decision — e.g. " +
      "read `triage` before classifying, read `autopilot-verdict` before judging eligibility.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Skill name exactly as shown in the skills list" },
      },
      required: ["name"],
    },
  },
  {
    name: "search_knowledge_base",
    description:
      "Semantic search over this organization's knowledge base (company docs, policies, FAQs). " +
      "Returns up to `topK` chunks with content and source URLs. " +
      "Call this when you need grounded information to answer the ticket accurately. " +
      "You may call it multiple times with different queries to gather wider context.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "What to search for — phrase it like the information you need" },
        topK: { type: "number", description: "How many chunks to return (default 3, max 10)" },
      },
      required: ["query"],
    },
  },
  {
    name: "lookup_shopify_context",
    description:
      "Fetch the customer's Shopify profile and recent orders. " +
      "Only call this if the ticket is about something a Shopify lookup would answer " +
      "(order status, tracking, refund/return, account) AND the org has a Shopify integration. " +
      "Provide the customer email from the ticket. Optionally include a specific order identifier " +
      "like '#1042' if the customer mentions one. Returns an error field if no integration is configured.",
    input_schema: {
      type: "object" as const,
      properties: {
        customerEmail: { type: "string", description: "The customer's email address (from the ticket)" },
        orderIdentifier: {
          type: "string",
          description: "Specific order number mentioned in the ticket, e.g. '#1042'. Omit if not mentioned.",
        },
      },
      required: ["customerEmail"],
    },
  },
  {
    name: "submit_analysis",
    description:
      "Terminal tool — call this exactly once when you have gathered enough context. " +
      "It records your triage verdict (category, autopilot eligibility, escalation) and ends the analysis phase. " +
      "After this, the harness will generate the customer-facing draft using the chunks and customer context you retrieved. " +
      "Do not write the draft yourself in text — just submit your analysis.",
    input_schema: {
      type: "object" as const,
      properties: {
        category: {
          type: "string",
          description:
            "Ticket category: one of 'order_status', 'return_refund', 'product_question', 'account_issue', 'general_policy', 'other'",
        },
        autopilotTopicId: {
          type: "string",
          description: "UUID of the matched autopilot topic from the provided topic list, if any. Omit if no match.",
        },
        autopilotConfidence: {
          type: "number",
          description: "0.0-1.0 confidence that the ticket matches the autopilot topic. Omit if no match.",
        },
        autopilotReasoning: {
          type: "string",
          description: "Brief explanation of the autopilot topic decision.",
        },
        escalationFlag: {
          type: "boolean",
          description: "True if this ticket needs human escalation (complaint, legal, VIP, unusual situation).",
        },
        escalationReason: {
          type: "string",
          description: "Why escalation is warranted. Omit if escalationFlag is false.",
        },
        draftInstructions: {
          type: "string",
          description:
            "Short guidance (1-3 sentences) for the draft-reply phase: key points to address, policies that apply, " +
            "tone adjustments beyond the org's default voice. The drafter will read this alongside the retrieved chunks.",
        },
      },
      required: ["category", "escalationFlag", "draftInstructions"],
    },
  },
];

/**
 * Execute a tool call. Always returns a string (the tool_result content).
 * Errors are returned as strings, not thrown — the model can read them
 * and adapt rather than crashing the loop.
 */
export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  ctx: AgentContext,
  skills: Skill[]
): Promise<string> {
  try {
    switch (name) {
      case "read_skill":
        return readSkill(input as { name: string }, skills);
      case "search_knowledge_base":
        return await searchKnowledgeBase(input as { query: string; topK?: number }, ctx);
      case "lookup_shopify_context":
        return await lookupShopifyContext(
          input as { customerEmail: string; orderIdentifier?: string },
          ctx
        );
      case "submit_analysis":
        return submitAnalysis(input as Record<string, unknown>, ctx);
      default:
        return `Error: unknown tool "${name}"`;
    }
  } catch (err) {
    return `Error calling ${name}: ${err instanceof Error ? err.message : String(err)}`;
  }
}

function readSkill(input: { name: string }, skills: Skill[]): string {
  const skill = findSkill(skills, input.name);
  if (!skill) {
    return `Error: no skill named "${input.name}". Available: ${skills.map((s) => s.name).join(", ")}`;
  }
  return skill.body;
}

async function searchKnowledgeBase(
  input: { query: string; topK?: number },
  ctx: AgentContext
): Promise<string> {
  const topK = Math.min(input.topK ?? 3, 10);
  const queryEmbedding = await embedText(input.query);

  const matches = await matchChunks({
    queryEmbedding,
    orgId: ctx.orgId,
    matchCount: topK,
    similarityThreshold: 0.3,
  });

  if (matches.length === 0) {
    return JSON.stringify({ chunks: [], note: "No relevant chunks found above similarity threshold." });
  }

  const pageIds = [...new Set(matches.map((m) => m.page_id))];
  const pages = await db
    .select({ id: knowledgeBasePages.id, url: knowledgeBasePages.url, title: knowledgeBasePages.title })
    .from(knowledgeBasePages)
    .where(inArray(knowledgeBasePages.id, pageIds));
  const pageMap = new Map(pages.map((p) => [p.id, p]));

  const chunks: RetrievedChunk[] = matches.map((m) => ({
    ...m,
    source_url: pageMap.get(m.page_id)?.url ?? undefined,
  }));

  // Accumulate for the draft-reply phase. Dedupe by chunk id across calls.
  const existingIds = new Set(ctx.retrievedChunks.map((c) => c.id));
  for (const chunk of chunks) {
    if (!existingIds.has(chunk.id)) ctx.retrievedChunks.push(chunk);
  }

  return JSON.stringify({
    chunks: chunks.map((c) => ({
      id: c.id,
      similarity: Number(c.similarity.toFixed(3)),
      source: c.source_url ?? pageMap.get(c.page_id)?.title ?? "Knowledge Base",
      content: c.content,
    })),
  });
}

async function lookupShopifyContext(
  input: { customerEmail: string; orderIdentifier?: string },
  ctx: AgentContext
): Promise<string> {
  const shopify = await createShopifyClient(ctx.orgId);
  if (!shopify) {
    return JSON.stringify({ error: "No Shopify integration configured for this organization." });
  }

  const context = await shopify
    .getCustomerContext(input.customerEmail, input.orderIdentifier ?? null)
    .catch((err) => {
      console.error("Shopify lookup failed:", err);
      return null;
    });

  if (!context) {
    return JSON.stringify({ error: "Shopify lookup failed. Proceed without customer data." });
  }

  // Cache for the draft-reply phase
  ctx.customerContext = context;

  return JSON.stringify(context);
}

function submitAnalysis(input: Record<string, unknown>, ctx: AgentContext): string {
  const analysis: AgentAnalysis = {
    category: String(input.category ?? "other"),
    autopilotTopicId: typeof input.autopilotTopicId === "string" ? input.autopilotTopicId : null,
    autopilotConfidence:
      typeof input.autopilotConfidence === "number" ? input.autopilotConfidence : null,
    autopilotReasoning:
      typeof input.autopilotReasoning === "string" ? input.autopilotReasoning : null,
    escalationFlag: Boolean(input.escalationFlag),
    escalationReason:
      typeof input.escalationReason === "string" ? input.escalationReason : null,
    draftInstructions:
      typeof input.draftInstructions === "string" ? input.draftInstructions : "",
  };

  ctx.analysis = analysis;
  return "Analysis recorded. The harness will now generate the draft.";
}
