import Anthropic from "@anthropic-ai/sdk";

export interface LLMProvider {
  generateDraft(systemPrompt: string, userMessage: string): Promise<string>;
}

class AnthropicProvider implements LLMProvider {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  async generateDraft(systemPrompt: string, userMessage: string): Promise<string> {
    const response = await this.client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const block = response.content[0];
    if (block.type === "text") {
      return block.text;
    }
    throw new Error("Unexpected response type from LLM");
  }
}

export function createLLMProvider(): LLMProvider {
  return new AnthropicProvider();
}
