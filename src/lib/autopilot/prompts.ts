import type { AutopilotTopicRow } from "./types";

export function buildTopicClassificationPrompt(
  topics: AutopilotTopicRow[],
  customerMessage: string,
  conversationHistory?: { role: "customer" | "agent"; content: string }[]
): { system: string; user: string } {
  const topicList = topics
    .map((t, i) => `${i + 1}. "${t.name}" — ${t.description}`)
    .join("\n");

  const system = `You are a customer support email classifier. You will be given a customer email (and optionally prior conversation history) and a list of topic categories. Classify the conversation into exactly one topic or "none" if it does not clearly fit any category.

When conversation history is provided, use the full context to understand what the customer is asking about — not just the latest message in isolation.

Output valid JSON with these fields:
- topic_index: the 1-based index of the matched topic, or 0 if none match
- topic_name: the name of the matched topic, or "none"
- confidence: a number from 0.0 to 1.0 representing how confident you are in the classification
- reasoning: one sentence explaining your classification

Be conservative — only assign a topic if the email clearly falls within that category. When in doubt, return "none" with low confidence.

Output ONLY the JSON object, no markdown or extra text.`;

  let user = `Topic categories:
${topicList}

`;

  if (conversationHistory && conversationHistory.length > 0) {
    const historyText = conversationHistory
      .map((msg) => `[${msg.role === "customer" ? "Customer" : "Agent"}]: ${msg.content}`)
      .join("\n\n");
    user += `Conversation history:
${historyText}

`;
  }

  user += `Latest customer email:
${customerMessage}

Classify this email into one of the topic categories above, or "none" if it does not clearly fit any category.`;

  return { system, user };
}

export function buildRetrievalJudgePrompt(
  customerMessage: string,
  chunks: string[],
  customerContext: string | null
): { system: string; user: string } {
  const system = `You are evaluating whether the available context is sufficient to write a helpful, accurate response to a customer's question. You are NOT answering the question — you are judging whether the provided context is enough.

The available context may include:
1. **Knowledge base chunks** — general company information, policies, FAQs, and how-to guides.
2. **Customer context** — customer-specific data like order history, tracking numbers, and account details (only present if a customer data integration is connected).

Important distinctions:
- If the customer asks a general question (e.g., "what is your return policy?"), knowledge base content alone is sufficient.
- If the customer asks about their specific order/account and customer context data is provided, that counts as sufficient — the combination of KB + customer data can answer it.
- If the customer asks about their specific order/account but NO customer context is provided, that is insufficient.
- General guidance (e.g., "here's how to track your order") is a valid answer when the KB contains the relevant instructions, even if no customer-specific data is available.

Output valid JSON with these fields:
- confidence: a number from 0.0 to 1.0 where 1.0 means "the context is definitely sufficient to write a complete, accurate response" and 0.0 means "the context is definitely NOT sufficient." A score of 0.8+ means sufficient.
- reasoning: one sentence explaining your judgment

Output ONLY the JSON object, no markdown or extra text.`;

  const formattedChunks = chunks
    .map((c, i) => `[Chunk ${i + 1}]:\n${c}`)
    .join("\n\n");

  let user = `Customer question:
${customerMessage}

Retrieved knowledge base context:
${formattedChunks}`;

  if (customerContext) {
    user += `\n\nCustomer context (from integrated data source):\n${customerContext}`;
  } else {
    user += `\n\nCustomer context: None available (no customer data integration connected or no matching customer found).`;
  }

  user += `\n\nJudge whether the context above is sufficient to write a complete, accurate response to this customer's question.`;

  return { system, user };
}

export function buildValidationPrompt(
  customerMessage: string,
  draftContent: string,
  chunks: string[],
  customerContext: string | null
): { system: string; user: string } {
  const system = `You are a critical evaluator reviewing an AI-generated customer support email draft before it is automatically sent. Your job is to find problems, not to be helpful. Evaluate the draft against the following criteria:

1. **Responsiveness**: Does the draft actually address what the customer asked?
2. **Accuracy**: Does the draft contain any information not supported by the provided context? Look for hallucinated details, numbers, dates, or policies. Only flag inaccuracies for claims the draft actually makes — do not penalize the draft for information that exists in the context but was not included.
3. **Scope**: Does the draft make any promises, commitments, or take any actions that should require human approval (refunds, account changes, legal language)?
4. **Completeness**: Does the draft fully resolve the customer's inquiry, or does it leave open questions?

Output valid JSON with these fields:
- checks: an object with keys "responsiveness", "accuracy", "scope", "completeness", each containing { "pass": boolean, "note": string }
- confidence: a number from 0.0 to 1.0 where 1.0 means "definitely safe to auto-send" and 0.0 means "definitely not safe to auto-send"
- reasoning: one sentence overall assessment

Be strict — when in doubt, fail the check. It is better to route to a human than to send a bad response.

Output ONLY the JSON object, no markdown or extra text.`;

  const formattedChunks = chunks
    .map((c, i) => `[Chunk ${i + 1}]:\n${c}`)
    .join("\n\n");

  let user = `Customer email:
${customerMessage}

AI-generated draft reply:
${draftContent}

Knowledge base context used:
${formattedChunks}`;

  if (customerContext) {
    user += `\n\nCustomer context:\n${customerContext}`;
  }

  return { system, user };
}

export function getConstrainedGenerationAddendum(): string {
  return `

IMPORTANT CONSTRAINT: You are generating a response that may be automatically sent without human review. Follow these rules strictly:
- Do not speculate or infer information not explicitly stated in the provided context.
- Always write your best attempt at a complete, helpful reply.
- If you cannot fully answer the customer's question from the provided context, still write your best attempt, then on a NEW line at the very end add:
NEEDS_HUMAN_REVIEW: [brief explanation of what information is missing]
- Do not include the NEEDS_HUMAN_REVIEW flag if you can fully answer the question from the context.`;
}
