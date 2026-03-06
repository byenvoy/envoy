import OpenAI from "openai";

const MODEL = "text-embedding-3-small";
const BATCH_SIZE = 100;

function getClient() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export async function embedText(text: string): Promise<number[]> {
  const client = getClient();
  const response = await client.embeddings.create({
    model: MODEL,
    input: text,
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
      input: batch,
    });
    // OpenAI returns embeddings in the same order as input
    const sorted = response.data.sort((a, b) => a.index - b.index);
    results.push(...sorted.map((d) => d.embedding));
  }

  return results;
}
