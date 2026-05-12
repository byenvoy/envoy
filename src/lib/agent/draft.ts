import Anthropic from "@anthropic-ai/sdk";
import { buildCustomerContentBlocks } from "@/lib/rag/prompt";
import { findSkill } from "@/lib/skills/loader";
import type { Skill } from "@/lib/skills/types";
import type { CitationBlock, BlockCitation } from "@/lib/rag/llm";
import type { RetrievedChunk, AgentAnalysis } from "./types";
import type { ShopifyCustomerContext } from "@/lib/types/shopify";

interface ConversationMessage {
  role: "customer" | "agent";
  content: string;
}

interface DraftParams {
  model: string;
  apiKey: string;
  companyName: string;
  customerMessage: string;
  customerEmail: string;
  customerName: string | null;
  conversationHistory: ConversationMessage[];
  chunks: RetrievedChunk[];
  customerContext: ShopifyCustomerContext | null;
  analysis: AgentAnalysis;
  skills: Skill[];
}

export interface DraftResult {
  text: string;
  citationBlocks?: CitationBlock[];
  model: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Phase 2 of the agent pipeline: generate the customer-facing draft.
 *
 * Separate API call (not part of the agent loop) so we can pass KB chunks
 * and Shopify data as Anthropic document blocks with `citations: enabled`.
 * The agent loop can't easily emit citations mid-flow; isolating draft
 * generation here preserves the existing citation UX.
 *
 * Voice skill is the SOLE source of truth for greeting and sign-off rules.
 * No org-settings reads here — the voice skill renderer (Phase 3a) bakes
 * those settings into the skill body, which is loaded into the system
 * prompt below.
 */
export async function generateDraft(params: DraftParams): Promise<DraftResult> {
  const client = new Anthropic({ apiKey: params.apiKey });

  const systemPrompt = buildDraftSystemPrompt(params);
  const docBlocks = buildDocumentBlocks(params.chunks, params.customerContext);

  const userContent: Anthropic.Messages.ContentBlockParam[] = [
    ...docBlocks,
    { type: "text", text: buildDraftUserMessage(params) },
  ];

  const response = await client.messages.create({
    model: params.model,
    max_tokens: 1024,
    // Cache the system prompt — voice skill + draft-reply skill are stable
    // across many requests for the same org.
    system: [
      {
        type: "text",
        text: systemPrompt,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userContent }],
  });

  return parseDraftResponse(response, params);
}

function buildDraftSystemPrompt(params: DraftParams): string {
  const sections: string[] = [
    `You are a customer support agent for ${params.companyName}. Your job is to write the customer-facing email reply.`,
  ];

  // Authored skills relevant to drafting. Org-level voice skill wins over
  // core drafter rules (handled in the loader's last-write-wins merge).
  const draftReplySkill = findSkill(params.skills, "draft-reply");
  const voiceSkill = findSkill(params.skills, "voice");

  if (draftReplySkill) {
    sections.push("", "## How to write replies", draftReplySkill.body);
  }

  if (voiceSkill) {
    sections.push("", "## Voice and tone", voiceSkill.body);
  }

  // Triage's per-ticket instructions
  if (params.analysis.draftInstructions) {
    sections.push("", "## Instructions for this ticket (from triage)", params.analysis.draftInstructions);
  }

  // Grounding rule is a safety invariant — always included regardless of skills.
  sections.push(
    "",
    "## Grounding (safety invariant)",
    "Every factual claim must trace to the provided knowledge base documents or customer data documents. " +
      "If the documents do not contain what's needed, briefly say you're checking and will follow up — do not fabricate details.",
    "Output only the email body. No subject line."
  );

  return sections.join("\n");
}

function buildDraftUserMessage(params: DraftParams): string {
  const parts: string[] = [];

  const senderLines = [`email: ${params.customerEmail}`];
  if (params.customerName) senderLines.push(`name (from From header): ${params.customerName}`);
  parts.push(`<sender>\n${senderLines.join("\n")}\n</sender>`);

  if (params.conversationHistory.length > 0) {
    const history = params.conversationHistory
      .map((m) => `  <message role="${m.role}">\n${m.content}\n  </message>`)
      .join("\n");
    parts.push(`<conversation_history>\n${history}\n</conversation_history>`);
  }

  parts.push(`<customer_email>\n${params.customerMessage}\n</customer_email>`);
  parts.push("Draft a reply to the email above.");

  return parts.join("\n\n");
}

function buildDocumentBlocks(
  chunks: RetrievedChunk[],
  customerContext: ShopifyCustomerContext | null
): Anthropic.Messages.DocumentBlockParam[] {
  const blocks: Anthropic.Messages.DocumentBlockParam[] = [];

  for (const chunk of chunks) {
    blocks.push({
      type: "document",
      source: { type: "text", media_type: "text/plain", data: chunk.content },
      title: chunk.source_url ?? "Knowledge Base",
      citations: { enabled: true },
    });
  }

  const hasCustomerData =
    customerContext && (customerContext.customer || customerContext.recent_orders.length > 0);
  if (hasCustomerData) {
    blocks.push({
      type: "document",
      source: { type: "content", content: buildCustomerContentBlocks(customerContext) },
      title: "Customer Data",
      citations: { enabled: true },
    });
  }

  return blocks;
}

function parseDraftResponse(
  response: Anthropic.Messages.Message,
  params: DraftParams
): DraftResult {
  let fullText = "";
  const citationBlocks: CitationBlock[] = [];

  for (const block of response.content) {
    if (block.type !== "text" || !block.text) continue;
    fullText += block.text;

    const blockCitations: BlockCitation[] = [];
    for (const c of block.citations ?? []) {
      if (c.type !== "char_location" && c.type !== "content_block_location") continue;
      const citation: BlockCitation = {
        citedText: c.cited_text,
        documentIndex: c.document_index,
      };
      const sourceUrl = params.chunks[c.document_index]?.source_url;
      if (sourceUrl) citation.sourceUrl = sourceUrl;
      if (c.document_title) citation.documentTitle = c.document_title;
      blockCitations.push(citation);
    }

    citationBlocks.push(
      blockCitations.length > 0 ? { text: block.text, citations: blockCitations } : { text: block.text }
    );
  }

  const hasCitations = citationBlocks.some((b) => b.citations && b.citations.length > 0);

  return {
    text: fullText,
    citationBlocks: hasCitations ? citationBlocks : undefined,
    model: params.model,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}
