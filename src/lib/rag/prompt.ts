interface ConversationMessage {
  role: "customer" | "agent";
  content: string;
}

interface PromptInput {
  companyName: string;
  chunks: { content: string; sourceUrl?: string }[];
  customerMessage: string;
  conversationHistory?: ConversationMessage[];
}

interface PromptOutput {
  system: string;
  user: string;
}

export function buildDraftPrompt({ companyName, chunks, customerMessage, conversationHistory }: PromptInput): PromptOutput {
  const system = `You are a customer support agent for ${companyName}. Your job is to draft helpful, concise, and professional email replies to customer inquiries.

Rules:
- Only use information from the provided knowledge base context to answer questions.
- If the knowledge base does not contain enough information to answer the question, say so honestly and suggest the customer contact support directly for further help.
- Write in a friendly, professional tone.
- Output only the email body text — no subject line, no greeting preamble like "Dear Customer", just the helpful response content ready to send.
- Keep responses concise and to the point.`;

  const contextSection = chunks
    .map((chunk, i) => {
      const source = chunk.sourceUrl ? ` (Source: ${chunk.sourceUrl})` : "";
      return `--- Context ${i + 1}${source} ---\n${chunk.content}`;
    })
    .join("\n\n");

  const historySection =
    conversationHistory && conversationHistory.length > 0
      ? `## Conversation History

${conversationHistory
  .map(
    (msg) =>
      `[${msg.role === "customer" ? "Customer" : "Agent"}]: ${msg.content}`
  )
  .join("\n\n")}

`
      : "";

  const user = `## Knowledge Base Context

${contextSection}

${historySection}## Customer Email

${customerMessage}

Please draft a reply to this customer email using only the knowledge base context provided above.`;

  return { system, user };
}
