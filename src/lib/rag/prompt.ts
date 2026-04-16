import type { ShopifyCustomerContext } from "@/lib/types/shopify";

interface ConversationMessage {
  role: "customer" | "agent";
  content: string;
}

interface PromptInput {
  companyName: string;
  chunks: { content: string; sourceUrl?: string }[];
  customerMessage: string;
  conversationHistory?: ConversationMessage[];
  customerContext?: ShopifyCustomerContext | null;
  tone?: string;
  customInstructions?: string | null;
  greeting?: string | null;
  customerName?: string | null;
}

interface PromptOutput {
  system: string;
  user: string;
}

const TONE_DESCRIPTIONS: Record<string, string> = {
  professional:
    "Write in a professional, polished tone. Use clear and precise language. Be courteous but not overly familiar. Avoid slang and casual phrasing.",
  casual:
    "Write in a casual, conversational tone. Use contractions freely, keep sentences short, and sound approachable — like a helpful colleague, not a corporate representative.",
  technical:
    "Write in a technical, detail-oriented tone. Be precise with terminology, include specifics where relevant, and assume the reader is comfortable with technical language. Stay clear but don't oversimplify.",
  friendly:
    "Write in a warm, friendly tone. Be empathetic and personable. Use the customer's name when available. Show genuine care about their issue while staying helpful and solution-focused.",
};

// --- Section builders ---

function buildCustomerDataRules(): string {
  return `<customer_data_rules>
- Use data from <customer_context> to give personalized, accurate answers. Only reference order numbers, tracking numbers, and other customer-specific details that actually appear in <customer_context> — do not invent them.
- If the customer asks about an order, identify which one they mean from any clues in their message (dates, product names, order numbers). If no identifying details are given, assume their most recent order. State which order you're referring to (e.g., "Regarding your order #1001 from March 11th...") so they can correct you if wrong. Answer about the most likely order rather than asking the customer to clarify — it keeps the conversation moving.
- When referencing fulfillment statuses, explain them in plain language. For example: "partially fulfilled" means some items have shipped but others are still being prepared; "unfulfilled" means the order is being processed and hasn't shipped yet; "fulfilled" means all items have shipped.
- When tracking information is available, include both the tracking number and the tracking URL so the customer can check their shipment status directly.
</customer_data_rules>`;
}

function buildSystemPrompt(
  companyName: string,
  hasCustomerContext: boolean,
  tone?: string,
  customInstructions?: string | null,
  greeting?: string | null,
  customerName?: string | null,
): string {
  const toneInstruction = TONE_DESCRIPTIONS[tone ?? "professional"] ?? `Write in a ${tone} tone.`;

  let greetingRule: string;
  if (greeting && customerName) {
    const firstName = customerName.split(" ")[0];
    const resolvedGreeting = greeting.replace("{name}", firstName);
    greetingRule = `Begin the reply with "${resolvedGreeting}". If the customer uses a different name or nickname for themselves in their email, use that instead.`;
  } else {
    greetingRule = "Do not include a greeting.";
  }

  const groundingSources = hasCustomerContext
    ? "<knowledge_base> and <customer_context>"
    : "<knowledge_base>";

  const sections: string[] = [
    `You are a customer support agent for ${companyName}. Your job is to draft helpful, concise, and professional email replies to customer inquiries.`,
    "",
    "<instructions>",
    "<output_format>",
    "Output only the email body text — no subject line, no sign-off.",
    greetingRule,
    "Match reply length to the question's complexity — a simple status question deserves a short answer, a multi-part question may need more. Skip background context and filler that doesn't help the customer act on the answer.",
    "</output_format>",
    "",
    "<tone>",
    toneInstruction,
    "</tone>",
    "",
    "<ground_in_context>",
    `Do not answer from memory about the company, its products, or its policies. Every factual claim in your reply must trace back to ${groundingSources}.`,
    "",
    `If ${groundingSources} does not contain what's needed to answer, briefly acknowledge you're not sure and say you'll find out and get back to them — don't fabricate details to fill the gap, and don't redirect the customer to another channel since they are already talking to support.`,
    "</ground_in_context>",
    "",
    "<verify_before_finalizing>",
    "Before writing your final reply, verify:",
    `- Every factual claim (policies, order numbers, dates, tracking data) appears in ${groundingSources}.`,
    "- You have not claimed to perform any action (\"I've processed...\", \"I've updated...\", \"I've issued...\") that the system has not actually done.",
    "- The reply answers what the customer asked.",
    "If any check fails, revise before producing your reply.",
    "</verify_before_finalizing>",
  ];

  if (hasCustomerContext) {
    sections.push("", buildCustomerDataRules());
  }

  if (customInstructions) {
    sections.push("", "<company_specific_instructions>", customInstructions, "</company_specific_instructions>");
  }

  sections.push("</instructions>");

  return sections.join("\n");
}

function formatCustomerContext(ctx: ShopifyCustomerContext): string {
  const lines: string[] = [];

  if (ctx.customer) {
    const name = [ctx.customer.first_name, ctx.customer.last_name]
      .filter(Boolean)
      .join(" ") || "Unknown";
    lines.push(`Customer: ${name} (${ctx.customer.email})`);
    lines.push(
      `Customer since: ${new Date(ctx.customer.created_at).toLocaleDateString()}`
    );
    lines.push(
      `Total orders: ${ctx.customer.orders_count} | Total spent: $${ctx.customer.total_spent}`
    );
  }

  if (ctx.recent_orders.length > 0) {
    lines.push("");
    lines.push("Recent Orders:");
    for (const order of ctx.recent_orders) {
      const date = new Date(order.created_at).toLocaleDateString();
      lines.push(
        `- ${order.name} (${date}): ${order.financial_status}, ${order.fulfillment_status ?? "Unfulfilled"}`
      );
      const items = order.line_items
        .map((li) => `${li.title}${li.variant_title ? ` (${li.variant_title})` : ""} x${li.quantity}`)
        .join(", ");
      lines.push(`  Items: ${items}`);

      for (const f of order.fulfillments) {
        if (f.tracking_number) {
          lines.push(
            `  Tracking: ${f.tracking_number}${f.tracking_url ? ` — ${f.tracking_url}` : ""}`
          );
        }
        if (f.estimated_delivery_at) {
          lines.push(
            `  Estimated delivery: ${new Date(f.estimated_delivery_at).toLocaleDateString()}`
          );
        }
      }
    }
  }

  if (ctx.active_returns.length > 0) {
    lines.push("");
    lines.push("Active Returns:");
    for (const ret of ctx.active_returns) {
      lines.push(`- ${ret.name}: ${ret.status}`);
    }
  }

  return lines.join("\n");
}

function buildKnowledgeBaseSection(chunks: { content: string; sourceUrl?: string }[]): string {
  const documents = chunks
    .map((chunk, i) => {
      const source = chunk.sourceUrl
        ? `    <source>${chunk.sourceUrl}</source>\n`
        : "";
      return `  <document index="${i + 1}">\n${source}    <content>\n${chunk.content}\n    </content>\n  </document>`;
    })
    .join("\n");

  return `<knowledge_base>\n${documents}\n</knowledge_base>`;
}

function buildCustomerContextSection(customerContext?: ShopifyCustomerContext | null): string {
  const hasContext = customerContext && (customerContext.customer || customerContext.recent_orders.length > 0);
  if (!hasContext) return "";

  return `<customer_context>\n${formatCustomerContext(customerContext!)}\n</customer_context>`;
}

function buildConversationHistorySection(history?: ConversationMessage[]): string {
  if (!history || history.length === 0) return "";

  const formatted = history
    .map((msg) => `  <message role="${msg.role}">\n${msg.content}\n  </message>`)
    .join("\n");

  return `<conversation_history>\n${formatted}\n</conversation_history>`;
}

function buildUserPrompt(
  chunks: { content: string; sourceUrl?: string }[],
  customerMessage: string,
  hasCustomerContext: boolean,
  conversationHistory?: ConversationMessage[],
  customerContext?: ShopifyCustomerContext | null,
): string {
  const groundingSources = hasCustomerContext
    ? "<knowledge_base> and <customer_context>"
    : "<knowledge_base>";

  const sections = [
    buildKnowledgeBaseSection(chunks),
    buildCustomerContextSection(customerContext),
    buildConversationHistorySection(conversationHistory),
    `<customer_email>\n${customerMessage}\n</customer_email>`,
    `Draft a reply to the email in <customer_email>, grounded in ${groundingSources}.`,
  ].filter(Boolean);

  return sections.join("\n\n");
}

// --- Main export ---

export function buildDraftPrompt({
  companyName,
  chunks,
  customerMessage,
  conversationHistory,
  customerContext,
  tone,
  customInstructions,
  greeting,
  customerName,
}: PromptInput): PromptOutput {
  const hasCustomerContext = !!(customerContext && (customerContext.customer || customerContext.recent_orders.length > 0));

  return {
    system: buildSystemPrompt(companyName, hasCustomerContext, tone, customInstructions, greeting, customerName),
    user: buildUserPrompt(chunks, customerMessage, hasCustomerContext, conversationHistory, customerContext),
  };
}
