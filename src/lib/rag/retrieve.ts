import { db } from "@/lib/db";
import { organizations, knowledgeBasePages } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { matchChunks, type MatchedChunk } from "@/lib/db/helpers";
import { embedText } from "./embeddings";
import { buildDraftPrompt, formatCustomerContext, buildCustomerContentBlocks } from "./prompt";
import { createLLMProvider, SUPPORTED_MODELS } from "./llm";
import type { CitationBlock } from "./llm";
import { classifyTicket } from "./classify";
import { logUsage } from "@/lib/usage/log";
import { createShopifyClient } from "@/lib/integrations/shopify-client-factory";
import type { ShopifyCustomerContext, ClassificationResult } from "@/lib/types/shopify";

interface RetrieveChunk extends MatchedChunk {
  source_url?: string;
}

export interface RetrieveResult {
  draft: string;
  chunks: RetrieveChunk[];
  messageEmbedding: number[];
  customerContext: ShopifyCustomerContext | null;
  classification: ClassificationResult | null;
  model: string;
  inputTokens: number;
  outputTokens: number;
  /** Ordered text blocks with inline citation metadata. Anthropic models only. */
  citationBlocks?: CitationBlock[];
}

interface VectorSearchResult {
  chunks: RetrieveChunk[];
  queryEmbedding: number[];
}

async function doVectorSearch(
  orgId: string,
  customerMessage: string
): Promise<VectorSearchResult> {
  const queryEmbedding = await embedText(customerMessage);

  const matches = await matchChunks({
    queryEmbedding,
    orgId,
    matchCount: 3,
    similarityThreshold: 0.3,
  });

  const chunks: RetrieveChunk[] = matches.map((m) => ({ ...m }));

  if (chunks.length > 0) {
    const pageIds = [...new Set(chunks.map((c) => c.page_id))];
    const pages = await db
      .select({ id: knowledgeBasePages.id, url: knowledgeBasePages.url })
      .from(knowledgeBasePages)
      .where(inArray(knowledgeBasePages.id, pageIds));

    const pageUrlMap = new Map(pages.map((p) => [p.id, p.url]));

    for (const chunk of chunks) {
      chunk.source_url = pageUrlMap.get(chunk.page_id) ?? undefined;
    }
  }

  return { chunks, queryEmbedding };
}

export async function retrieveAndDraft({
  orgId,
  companyName,
  customerMessage,
  customerEmail,
  conversationHistory,
  injectConstrainedPrompt,
  customerName,
}: {
  orgId: string;
  companyName: string;
  customerMessage: string;
  customerEmail?: string;
  customerName?: string | null;
  conversationHistory?: { role: "customer" | "agent"; content: string }[];
  injectConstrainedPrompt?: boolean;
}): Promise<RetrieveResult> {
  // Fetch org settings
  const org = await db
    .select({
      preferredModel: organizations.preferredModel,
      tone: organizations.tone,
      customInstructions: organizations.customInstructions,
      greetingTemplate: organizations.greetingTemplate,
      signOff: organizations.signOff,
    })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .then((r) => r[0]);

  const model = org?.preferredModel ?? "claude-haiku-4-5-20251001";
  const tone = org?.tone ?? "professional";
  const customInstructions = org?.customInstructions ?? null;
  const greetingTemplate = org?.greetingTemplate ?? null;
  const signOff = org?.signOff ?? null;

  // Check if Shopify is connected
  const shopifyClient = await createShopifyClient(orgId);
  const hasShopify = !!shopifyClient;

  // Classify the ticket
  const classification = await classifyTicket({
    customerMessage,
    customerEmail,
    hasShopifyIntegration: hasShopify,
    model,
    orgId,
  });

  // Execute vector search and Shopify fetch in parallel
  const [vectorResult, customerContext] = await Promise.all([
    doVectorSearch(orgId, customerMessage),
    classification.needs_customer_data && customerEmail && shopifyClient
      ? shopifyClient
          .getCustomerContext(customerEmail, classification.order_identifier)
          .catch((err) => {
            console.error("Shopify fetch failed, continuing with KB-only:", err);
            return null;
          })
      : Promise.resolve(null),
  ]);

  const { chunks, queryEmbedding: messageEmbedding } = vectorResult;

  // When this email matches an autopilot topic, append constrained generation instructions (Gate 3)
  const effectiveInstructions = injectConstrainedPrompt
    ? (customInstructions ?? "") + (await import("@/lib/autopilot/prompts")).getConstrainedGenerationAddendum()
    : customInstructions;

  // For Anthropic models, pass KB chunks and Shopify customer context as document
  // blocks so the model can cite them natively. Other providers use the text prompt.
  const isAnthropic = SUPPORTED_MODELS[model]?.provider === "anthropic";
  const chunkObjects = chunks.map((c) => ({ content: c.content, sourceUrl: c.source_url }));

  const hasCustomerContext = !!(
    customerContext && (customerContext.customer || customerContext.recent_orders.length > 0)
  );

  // Build the source chunks array for Anthropic:
  // - KB chunks as plain text (auto sentence-chunked by Anthropic, good for prose)
  // - Customer context as custom content blocks (one fact per block, so the model
  //   can cite individual order fields like tracking numbers and delivery dates)
  const sourceChunks = isAnthropic
    ? [
        ...chunkObjects,
        ...(hasCustomerContext
          ? [{ contentBlocks: buildCustomerContentBlocks(customerContext!), title: "Customer Data" }]
          : []),
      ]
    : undefined;

  const { system, user } = buildDraftPrompt({
    companyName,
    chunks: chunkObjects,
    customerMessage,
    conversationHistory,
    customerContext,
    tone,
    customInstructions: effectiveInstructions,
    greeting: greetingTemplate,
    customerName,
    excludeChunks: isAnthropic && chunks.length > 0,
    excludeCustomerContext: isAnthropic && hasCustomerContext,
  });

  const llm = await createLLMProvider(model, orgId, { allowEnvFallback: false });
  const response = await llm.generateDraft(system, user, {
    sourceChunks: sourceChunks && sourceChunks.length > 0 ? sourceChunks : undefined,
  });

  // Log draft usage
  await logUsage({
    orgId,
    callType: "draft",
    model: response.model,
    inputTokens: response.inputTokens,
    outputTokens: response.outputTokens,
  });

  // If there's a sign-off, append it as a final uncited block so annotatedHtml
  // renders the complete draft (not just the LLM response portion).
  let citationBlocks = response.citationBlocks;
  if (signOff && citationBlocks) {
    citationBlocks = [...citationBlocks, { text: `\n\n${signOff}` }];
  }

  return {
    draft: signOff ? `${response.text}\n\n${signOff}` : response.text,
    chunks,
    messageEmbedding,
    customerContext,
    classification,
    model: response.model,
    inputTokens: response.inputTokens,
    outputTokens: response.outputTokens,
    citationBlocks,
  };
}
