import { db } from "@/lib/db";
import { organizations, knowledgeBasePages } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { matchChunks, type MatchedChunk } from "@/lib/db/helpers";
import { embedText } from "./embeddings";
import { buildDraftPrompt } from "./prompt";
import { createLLMProvider } from "./llm";
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

  // Build prompt and generate draft
  const { system, user } = buildDraftPrompt({
    companyName,
    chunks: chunks.map((c) => ({
      content: c.content,
      sourceUrl: c.source_url,
    })),
    customerMessage,
    conversationHistory,
    customerContext,
    tone,
    customInstructions: effectiveInstructions,
    greeting: greetingTemplate,
    customerName,
  });

  const llm = await createLLMProvider(model, orgId);
  const response = await llm.generateDraft(system, user);

  // Log draft usage
  await logUsage({
    orgId,
    callType: "draft",
    model: response.model,
    inputTokens: response.inputTokens,
    outputTokens: response.outputTokens,
  });

  return {
    draft: signOff ? `${response.text}\n\n${signOff}` : response.text,
    chunks,
    messageEmbedding,
    customerContext,
    classification,
    model: response.model,
    inputTokens: response.inputTokens,
    outputTokens: response.outputTokens,
  };
}
