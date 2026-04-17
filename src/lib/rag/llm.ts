import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getOrgApiKey } from "@/lib/api-keys";

export interface BlockCitation {
  citedText: string;
  documentIndex: number;
  /** URL of the KB page, undefined for Customer Data and other non-URL sources */
  sourceUrl?: string;
  documentTitle?: string;
}

/**
 * A single block of draft text from the LLM response.
 * Blocks without citations are plain prose; cited blocks carry every citation
 * the model attached to that claim (a single claim can be backed by multiple
 * sources, e.g. a KB policy chunk AND a Customer Data field).
 * Storing blocks in order lets the UI render them sequentially without fragile
 * post-hoc regex matching against rendered HTML.
 */
export interface CitationBlock {
  /** Raw text (may contain markdown) for this block */
  text: string;
  /** All citations attached to this block, or absent if none */
  citations?: BlockCitation[];
}


export interface SourceChunk {
  /** Plain text content — used for KB chunks (auto-chunked into sentences by Anthropic) */
  content?: string;
  /**
   * Custom content blocks — used for structured data like Shopify customer context.
   * Each block is one atomic fact, giving the model citation granularity at the field level.
   * When present, `content` is ignored and a `content` source type document is used.
   */
  contentBlocks?: { type: "text"; text: string }[];
  sourceUrl?: string;
  title?: string;
}

export interface LLMResponse {
  text: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
  /** Ordered text blocks with citation metadata. Only populated for Anthropic models. */
  citationBlocks?: CitationBlock[];
}

export interface LLMProvider {
  generateDraft(
    systemPrompt: string,
    userMessage: string,
    options?: { sourceChunks?: SourceChunk[] }
  ): Promise<LLMResponse>;
}

export interface ModelConfig {
  provider: "anthropic" | "openai" | "google";
  label: string;
  logo: string;
  darkLogo?: string;
  costPer1kInput: number;
  costPer1kOutput: number;
  baseUrl?: string;
  envKey?: string;
}

export const SUPPORTED_MODELS: Record<string, ModelConfig> = {
  "claude-haiku-4-5-20251001": {
    provider: "anthropic",
    label: "Claude Haiku",
    logo: "/logos/anthropic.svg",
    darkLogo: "/logos/Anthropic symbol - Ivory.svg",
    envKey: "ANTHROPIC_API_KEY",
    costPer1kInput: 0.0008,
    costPer1kOutput: 0.004,
  },
  "claude-sonnet-4-6": {
    provider: "anthropic",
    label: "Claude Sonnet",
    logo: "/logos/anthropic.svg",
    darkLogo: "/logos/Anthropic symbol - Ivory.svg",
    envKey: "ANTHROPIC_API_KEY",
    costPer1kInput: 0.003,
    costPer1kOutput: 0.015,
  },
  "claude-opus-4-6": {
    provider: "anthropic",
    label: "Claude Opus",
    logo: "/logos/anthropic.svg",
    darkLogo: "/logos/Anthropic symbol - Ivory.svg",
    envKey: "ANTHROPIC_API_KEY",
    costPer1kInput: 0.015,
    costPer1kOutput: 0.075,
  },
  "gpt-4o": {
    provider: "openai",
    label: "GPT-4o",
    logo: "/logos/openai.svg",
    darkLogo: "/logos/OpenAI-white-monoblossom.svg",
    baseUrl: "https://api.openai.com/v1",
    envKey: "OPENAI_API_KEY",
    costPer1kInput: 0.0025,
    costPer1kOutput: 0.01,
  },
  "gpt-4o-mini": {
    provider: "openai",
    label: "GPT-4o Mini",
    logo: "/logos/openai.svg",
    darkLogo: "/logos/OpenAI-white-monoblossom.svg",
    baseUrl: "https://api.openai.com/v1",
    envKey: "OPENAI_API_KEY",
    costPer1kInput: 0.00015,
    costPer1kOutput: 0.0006,
  },
  "gemini-2.5-flash": {
    provider: "google",
    label: "Gemini 2.5 Flash",
    logo: "/logos/gemini-icon.png",
    envKey: "GOOGLE_AI_KEY",
    costPer1kInput: 0.00015,
    costPer1kOutput: 0.0006,
  },
  "gemini-2.0-flash": {
    provider: "google",
    label: "Gemini 2.0 Flash",
    logo: "/logos/gemini-icon.png",
    envKey: "GOOGLE_AI_KEY",
    costPer1kInput: 0.0001,
    costPer1kOutput: 0.0004,
  },
  "mistral-large-latest": {
    provider: "openai",
    label: "Mistral Large",
    logo: "/logos/mistral.svg",
    baseUrl: "https://api.mistral.ai/v1",
    envKey: "MISTRAL_API_KEY",
    costPer1kInput: 0.002,
    costPer1kOutput: 0.006,
  },
  "mistral-small-latest": {
    provider: "openai",
    label: "Mistral Small",
    logo: "/logos/mistral.svg",
    baseUrl: "https://api.mistral.ai/v1",
    envKey: "MISTRAL_API_KEY",
    costPer1kInput: 0.0001,
    costPer1kOutput: 0.0003,
  },
  "deepseek-chat": {
    provider: "openai",
    label: "DeepSeek V3",
    logo: "/logos/deepseek.svg",
    baseUrl: "https://api.deepseek.com/v1",
    envKey: "DEEPSEEK_API_KEY",
    costPer1kInput: 0.00014,
    costPer1kOutput: 0.00028,
  },
};

class AnthropicProvider implements LLMProvider {
  private client: Anthropic;
  private model: string;

  constructor(model: string, apiKey: string) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async generateDraft(
    systemPrompt: string,
    userMessage: string,
    options?: { sourceChunks?: SourceChunk[] }
  ): Promise<LLMResponse> {
    const { sourceChunks } = options ?? {};

    // Citations path: pass KB chunks and Shopify data as document blocks.
    // KB chunks use plain text (auto sentence-chunked by Anthropic).
    // Shopify customer context uses custom content blocks (one fact per block)
    // so the model can cite individual order fields rather than a whole blob.
    if (sourceChunks && sourceChunks.length > 0) {
      const docBlocks = sourceChunks.map((chunk) => {
        if (chunk.contentBlocks) {
          return {
            type: "document" as const,
            source: {
              type: "content" as const,
              content: chunk.contentBlocks,
            },
            title: chunk.title ?? "Customer Data",
            citations: { enabled: true },
          };
        }
        return {
          type: "document" as const,
          source: {
            type: "text" as const,
            media_type: "text/plain" as const,
            data: chunk.content ?? "",
          },
          title: chunk.title ?? chunk.sourceUrl ?? "Knowledge Base",
          citations: { enabled: true },
        };
      });

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{
          role: "user",
          content: [
            ...docBlocks,
            { type: "text", text: userMessage },
          ],
        }],
      });

      // Build ordered CitationBlocks — one per text block from the response.
      // Handles both char_location (plain text docs) and content_block_location
      // (custom content docs, i.e. Shopify data).
      let fullText = "";
      const citationBlocks: CitationBlock[] = [];

      for (const block of response.content) {
        if (block.type !== "text" || !block.text) continue;
        fullText += block.text;

        // Collect ALL citations on this block — a single claim can be backed by
        // multiple sources (e.g. a KB policy chunk + a Customer Data field).
        const blockCitations = (block.citations ?? [])
          .filter((c) => c.type === "char_location" || c.type === "content_block_location")
          .map((c) => {
            if (c.type !== "char_location" && c.type !== "content_block_location") return null;
            return {
              citedText: c.cited_text,
              documentIndex: c.document_index,
              sourceUrl: sourceChunks[c.document_index]?.sourceUrl,
              documentTitle: c.document_title ?? undefined,
            };
          })
          .filter((c): c is BlockCitation => c !== null);

        citationBlocks.push(
          blockCitations.length > 0
            ? { text: block.text, citations: blockCitations }
            : { text: block.text }
        );
      }

      const hasCitations = citationBlocks.some((b) => b.citations && b.citations.length > 0);
      return {
        text: fullText,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        model: this.model,
        citationBlocks: hasCitations ? citationBlocks : undefined,
      };
    }

    // Standard path (no citations)
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const block = response.content[0];
    if (block.type !== "text") {
      throw new Error("Unexpected response type from LLM");
    }

    return {
      text: block.text,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      model: this.model,
    };
  }
}

class OpenAICompatibleProvider implements LLMProvider {
  private client: OpenAI;
  private model: string;

  constructor(model: string, baseUrl: string, apiKey: string) {
    this.client = new OpenAI({ apiKey, baseURL: baseUrl });
    this.model = model;
  }

  async generateDraft(systemPrompt: string, userMessage: string, _options?: { sourceChunks?: SourceChunk[] }): Promise<LLMResponse> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: 1024,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    });

    const text = response.choices[0]?.message?.content;
    if (!text) {
      throw new Error("Empty response from LLM");
    }

    return {
      text,
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0,
      model: this.model,
    };
  }
}

class GoogleProvider implements LLMProvider {
  private model: string;
  private apiKey: string;

  constructor(model: string, apiKey: string) {
    this.model = model;
    this.apiKey = apiKey;
  }

  async generateDraft(systemPrompt: string, userMessage: string, _options?: { sourceChunks?: SourceChunk[] }): Promise<LLMResponse> {
    const genAI = new GoogleGenerativeAI(this.apiKey);
    const model = genAI.getGenerativeModel({
      model: this.model,
      systemInstruction: systemPrompt,
    });

    const result = await model.generateContent(userMessage);
    const response = result.response;
    const text = response.text();

    return {
      text,
      inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
      model: this.model,
    };
  }
}

export async function createLLMProvider(
  model?: string,
  orgId?: string,
  { allowEnvFallback = true }: { allowEnvFallback?: boolean } = {}
): Promise<LLMProvider> {
  const modelId = model ?? "claude-haiku-4-5-20251001";
  const config = SUPPORTED_MODELS[modelId];

  if (!config) {
    throw new Error(`Unsupported model: ${modelId}`);
  }

  const providerKey = config.envKey!;
  const apiKey = orgId
    ? await getOrgApiKey(orgId, providerKey, { allowEnvFallback })
    : process.env[providerKey] ?? null;

  if (!apiKey) throw new Error(`Missing API key for ${config.label} (${providerKey})`);

  switch (config.provider) {
    case "anthropic":
      return new AnthropicProvider(modelId, apiKey);
    case "openai":
      return new OpenAICompatibleProvider(modelId, config.baseUrl!, apiKey);
    case "google":
      return new GoogleProvider(modelId, apiKey);
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}
