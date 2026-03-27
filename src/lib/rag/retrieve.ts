import type { SupabaseClient } from "@supabase/supabase-js";
import { embedText } from "./embeddings";
import { buildDraftPrompt } from "./prompt";
import { createLLMProvider } from "./llm";
import { classifyTicket } from "./classify";
import { logUsage } from "@/lib/usage/log";
import { createShopifyClient } from "@/lib/integrations/shopify-client-factory";
import type { ShopifyCustomerContext, ClassificationResult } from "@/lib/types/shopify";

interface MatchedChunk {
  id: string;
  page_id: string;
  chunk_index: number;
  content: string;
  token_count: number;
  similarity: number;
  source_url?: string;
}

export interface RetrieveResult {
  draft: string;
  chunks: MatchedChunk[];
  messageEmbedding: number[];
  customerContext: ShopifyCustomerContext | null;
  classification: ClassificationResult | null;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

interface VectorSearchResult {
  chunks: MatchedChunk[];
  queryEmbedding: number[];
}

async function doVectorSearch(
  supabase: SupabaseClient,
  orgId: string,
  customerMessage: string
): Promise<VectorSearchResult> {
  const queryEmbedding = await embedText(customerMessage);

  const { data: matches, error } = await supabase.rpc("match_chunks", {
    query_embedding: JSON.stringify(queryEmbedding),
    filter_org_id: orgId,
    match_count: 3,
    similarity_threshold: 0.3,
  });

  if (error) throw error;

  const chunks: MatchedChunk[] = matches ?? [];

  if (chunks.length > 0) {
    const pageIds = [...new Set(chunks.map((c) => c.page_id))];
    const { data: pages } = await supabase
      .from("knowledge_base_pages")
      .select("id, url")
      .in("id", pageIds);

    const pageUrlMap = new Map(
      (pages ?? []).map((p: { id: string; url: string }) => [p.id, p.url])
    );

    for (const chunk of chunks) {
      chunk.source_url = pageUrlMap.get(chunk.page_id);
    }
  }

  return { chunks, queryEmbedding };
}

export async function retrieveAndDraft({
  supabase,
  orgId,
  companyName,
  customerMessage,
  customerEmail,
  conversationHistory,
  injectConstrainedPrompt,
}: {
  supabase: SupabaseClient;
  orgId: string;
  companyName: string;
  customerMessage: string;
  customerEmail?: string;
  conversationHistory?: { role: "customer" | "agent"; content: string }[];
  injectConstrainedPrompt?: boolean;
}): Promise<RetrieveResult> {
  // Fetch org settings
  const { data: org } = await supabase
    .from("organizations")
    .select("preferred_model, tone, custom_instructions")
    .eq("id", orgId)
    .single();

  const model = org?.preferred_model ?? "claude-haiku-4-5-20251001";
  const tone = org?.tone ?? "professional";
  const customInstructions = org?.custom_instructions ?? null;

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
    doVectorSearch(supabase, orgId, customerMessage),
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
    draft: response.text,
    chunks,
    messageEmbedding,
    customerContext,
    classification,
    model: response.model,
    inputTokens: response.inputTokens,
    outputTokens: response.outputTokens,
  };
}
