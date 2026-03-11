import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getOrgApiKey } from "@/lib/api-keys";

export interface LLMResponse {
  text: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
}

export interface LLMProvider {
  generateDraft(systemPrompt: string, userMessage: string): Promise<LLMResponse>;
}

interface ModelConfig {
  provider: "anthropic" | "openai" | "google";
  label: string;
  costPer1kInput: number;
  costPer1kOutput: number;
  baseUrl?: string;
  envKey?: string;
}

export const SUPPORTED_MODELS: Record<string, ModelConfig> = {
  "claude-haiku-4-5-20251001": {
    provider: "anthropic",
    label: "Claude Haiku",
    envKey: "ANTHROPIC_API_KEY",
    costPer1kInput: 0.0008,
    costPer1kOutput: 0.004,
  },
  "claude-sonnet-4-20250514": {
    provider: "anthropic",
    label: "Claude Sonnet",
    envKey: "ANTHROPIC_API_KEY",
    costPer1kInput: 0.003,
    costPer1kOutput: 0.015,
  },
  "gpt-4o": {
    provider: "openai",
    label: "GPT-4o",
    baseUrl: "https://api.openai.com/v1",
    envKey: "OPENAI_API_KEY",
    costPer1kInput: 0.0025,
    costPer1kOutput: 0.01,
  },
  "gpt-4o-mini": {
    provider: "openai",
    label: "GPT-4o Mini",
    baseUrl: "https://api.openai.com/v1",
    envKey: "OPENAI_API_KEY",
    costPer1kInput: 0.00015,
    costPer1kOutput: 0.0006,
  },
  "gemini-2.0-flash": {
    provider: "google",
    label: "Gemini Flash",
    envKey: "GOOGLE_AI_KEY",
    costPer1kInput: 0.0001,
    costPer1kOutput: 0.0004,
  },
  "mistral-large-latest": {
    provider: "openai",
    label: "Mistral Large",
    baseUrl: "https://api.mistral.ai/v1",
    envKey: "MISTRAL_API_KEY",
    costPer1kInput: 0.002,
    costPer1kOutput: 0.006,
  },
};

class AnthropicProvider implements LLMProvider {
  private client: Anthropic;
  private model: string;

  constructor(model: string, apiKey: string) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async generateDraft(systemPrompt: string, userMessage: string): Promise<LLMResponse> {
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

  async generateDraft(systemPrompt: string, userMessage: string): Promise<LLMResponse> {
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

  async generateDraft(systemPrompt: string, userMessage: string): Promise<LLMResponse> {
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

export async function createLLMProvider(model?: string, orgId?: string): Promise<LLMProvider> {
  const modelId = model ?? "claude-haiku-4-5-20251001";
  const config = SUPPORTED_MODELS[modelId];

  if (!config) {
    throw new Error(`Unsupported model: ${modelId}`);
  }

  const providerKey = config.envKey!;
  const apiKey = orgId
    ? await getOrgApiKey(orgId, providerKey)
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
