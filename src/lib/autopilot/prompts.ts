import type { AutopilotTopicRow } from "./types";

export function buildTopicClassificationPrompt(
  topics: AutopilotTopicRow[],
  customerMessage: string,
  conversationHistory?: { role: "customer" | "agent"; content: string }[]
): { system: string; user: string } {
  const topicList = topics
    .map((t) => `- "${t.name}" — ${t.description}`)
    .join("\n");

  const system = `You are a customer support email classifier. You will be given a customer email (and optionally prior conversation history) and a list of topic categories. Classify the conversation into exactly one topic or "none" if it does not clearly fit any category.

When conversation history is provided, use the full context to understand what the customer is asking about — not just the latest message in isolation.

Output valid JSON with these fields:
- topic_name: the name of the matched topic (exactly as written above), or "none"
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
  customerContext: string | null,
  conversationHistory?: { role: "customer" | "agent"; content: string }[]
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
- confidence: a number from 0.0 to 1.0 where 1.0 means "the context is definitely sufficient to write a complete, accurate response" and 0.0 means "the context is definitely NOT sufficient."
- reasoning: one sentence explaining your judgment

Output ONLY the JSON object, no markdown or extra text.`;

  const formattedChunks = chunks
    .map((c, i) => `[Chunk ${i + 1}]:\n${c}`)
    .join("\n\n");

  let user = `Customer question:
${customerMessage}`;

  if (conversationHistory && conversationHistory.length > 0) {
    const historyText = conversationHistory
      .map((msg) => `[${msg.role === "customer" ? "Customer" : "Agent"}]: ${msg.content}`)
      .join("\n\n");
    user += `\n\nConversation history:\n${historyText}`;
  }

  user += `\n\nRetrieved knowledge base context:\n${formattedChunks}`;

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
  customerContext: string | null,
  conversationHistory?: { role: "customer" | "agent"; content: string }[]
): { system: string; user: string } {
  const system = `You are a quality gate for AI-generated customer support email drafts before they are automatically sent. Evaluate each draft against the criteria below and return a structured verdict. If any check is uncertain, mark it as failing — the draft will be routed to a human reviewer instead of being auto-sent, which is the safe default.

<criteria>
<responsiveness>
Does the draft actually address what the customer asked? A draft that answers a different question, or only partially engages with the request, fails this check.
</responsiveness>

<accuracy>
Does every factual claim in the draft appear in <knowledge_base> or <customer_context>? Flag hallucinated details, numbers, dates, tracking numbers, or policies. Only evaluate claims the draft actually makes — do not penalize the draft for information that exists in the context but was not included.
</accuracy>

<scope>
Does the draft make new commitments or grant exceptions on behalf of the company? For example: "I've processed your refund," "I'll make an exception in your case," "I've updated your account." These are scope violations because the AI cannot actually take those actions.

Restating existing company policy from the knowledge base (e.g., "Our return policy allows refunds within 30 days") is NOT a scope issue. Only flag when the draft commits to a specific action or grants an exception that hasn't been approved.
</scope>

<completeness>
Does the draft fully resolve the customer's inquiry, or does it leave open questions the customer will need to follow up on?
</completeness>
</criteria>

<examples>
<example>
<customer_email>What's your return policy for items I bought 2 weeks ago?</customer_email>
<knowledge_base>Returns are accepted within 30 days of delivery for unworn items with tags attached.</knowledge_base>
<draft_reply>Hi Sarah, yes — your order is within our 30-day return window. You can return unworn items with tags attached. Let me know if you'd like help starting a return.</draft_reply>
<verdict>
{
  "checks": {
    "responsiveness": { "pass": true, "note": "Directly addresses the return window question." },
    "accuracy": { "pass": true, "note": "30-day window and unworn/tags conditions are stated in the KB." },
    "scope": { "pass": true, "note": "States existing policy; no unilateral commitments." },
    "completeness": { "pass": true, "note": "Fully answers the question and offers a clear next step." }
  },
  "confidence": 0.95,
  "reasoning": "Grounded, accurate policy answer that fully addresses the question."
}
</verdict>
</example>

<example>
<customer_email>I want to return order #1042, the shirt doesn't fit.</customer_email>
<knowledge_base>Returns are accepted within 30 days of delivery. Contact support to initiate a return.</knowledge_base>
<draft_reply>Hi Sarah, I've processed your return for order #1042. You'll receive a refund within 5-7 business days.</draft_reply>
<verdict>
{
  "checks": {
    "responsiveness": { "pass": true, "note": "Addresses the return request." },
    "accuracy": { "pass": false, "note": "The 5-7 business day refund timeline is not stated in the knowledge base." },
    "scope": { "pass": false, "note": "\\"I've processed your return\\" claims an action was taken — this is a unilateral commitment the AI cannot make." },
    "completeness": { "pass": true, "note": "The reply reads as complete on its face." }
  },
  "confidence": 0.1,
  "reasoning": "Fails accuracy (fabricated timeline) and scope (commits to an action not yet taken by a human agent)."
}
</verdict>
</example>

<example>
<customer_email>When will order #1042 arrive?</customer_email>
<customer_context>Order #1042 — Shipped. No tracking number available yet.</customer_context>
<draft_reply>Hi Sarah, your order #1042 will arrive on April 20th via FedEx. The tracking number is 9876543210.</draft_reply>
<verdict>
{
  "checks": {
    "responsiveness": { "pass": true, "note": "Addresses the delivery-date question." },
    "accuracy": { "pass": false, "note": "Tracking number, carrier, and delivery date are not present in <customer_context>." },
    "scope": { "pass": true, "note": "No unilateral commitments." },
    "completeness": { "pass": true, "note": "Directly answers the question." }
  },
  "confidence": 0.05,
  "reasoning": "Fails accuracy — the draft invents tracking details not present in the customer context."
}
</verdict>
</example>
</examples>

<output_format>
Output valid JSON only — no markdown fences, no preamble, no explanation outside the JSON. Schema:
{
  "checks": {
    "responsiveness": { "pass": boolean, "note": string },
    "accuracy": { "pass": boolean, "note": string },
    "scope": { "pass": boolean, "note": string },
    "completeness": { "pass": boolean, "note": string }
  },
  "confidence": number,  // 0.0 = definitely not safe to auto-send, 1.0 = definitely safe
  "reasoning": string    // one-sentence overall assessment
}
</output_format>`;

  const formattedChunks = chunks
    .map((c, i) => `  <chunk index="${i + 1}">\n${c}\n  </chunk>`)
    .join("\n");

  const parts: string[] = [];

  parts.push(`<customer_email>\n${customerMessage}\n</customer_email>`);

  if (conversationHistory && conversationHistory.length > 0) {
    const historyText = conversationHistory
      .map((msg) => `  <message role="${msg.role}">\n${msg.content}\n  </message>`)
      .join("\n");
    parts.push(`<conversation_history>\n${historyText}\n</conversation_history>`);
  }

  parts.push(`<draft_reply>\n${draftContent}\n</draft_reply>`);
  parts.push(`<knowledge_base>\n${formattedChunks}\n</knowledge_base>`);

  if (customerContext) {
    parts.push(`<customer_context>\n${customerContext}\n</customer_context>`);
  }

  parts.push("Evaluate the draft reply in <draft_reply> against the criteria and return the JSON verdict.");

  return { system, user: parts.join("\n\n") };
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
