import OpenAI from "openai";

const MODEL = "text-embedding-3-small";
const BATCH_SIZE = 100;
// text-embedding-3-small supports 8191 tokens; ~4 chars/token → 30,000 chars is safe
const MAX_CHARS = 30_000;

function truncate(text: string): string {
  return text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) : text;
}

function getClient() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export async function embedText(text: string): Promise<number[]> {
  const client = getClient();
  const response = await client.embeddings.create({
    model: MODEL,
    input: truncate(text),
  });
  return response.data[0].embedding;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const client = getClient();
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const response = await client.embeddings.create({
      model: MODEL,
      input: batch.map(truncate),
    });
    // OpenAI returns embeddings in the same order as input
    const sorted = response.data.sort((a, b) => a.index - b.index);
    results.push(...sorted.map((d) => d.embedding));
  }

  return results;
}
