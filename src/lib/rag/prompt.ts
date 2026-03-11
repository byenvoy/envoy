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
}

interface PromptOutput {
  system: string;
  user: string;
}

const TONE_DESCRIPTIONS: Record<string, string> = {
  professional:
    "Write in a professional, polished tone. Use clear and precise language. Be courteous but not overly familiar. Avoid slang, contractions, and casual phrasing.",
  casual:
    "Write in a casual, conversational tone. Use contractions freely, keep sentences short, and sound approachable — like a helpful colleague, not a corporate representative.",
  technical:
    "Write in a technical, detail-oriented tone. Be precise with terminology, include specifics where relevant, and assume the reader is comfortable with technical language. Stay clear but don't oversimplify.",
  friendly:
    "Write in a warm, friendly tone. Be empathetic and personable. Use the customer's name when available. Show genuine care about their issue while staying helpful and solution-focused.",
};

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

export function buildDraftPrompt({ companyName, chunks, customerMessage, conversationHistory, customerContext, tone, customInstructions }: PromptInput): PromptOutput {
  const hasCustomerContext = customerContext && (customerContext.customer || customerContext.recent_orders.length > 0);

  const customerDataRules = hasCustomerContext
    ? `
- Use customer-specific data when provided to give personalized, accurate answers.
- Never fabricate order numbers, tracking numbers, or customer data — only reference what is provided in the Customer Context section.`
    : "";

  const system = `You are a customer support agent for ${companyName}. Your job is to draft helpful, concise, and professional email replies to customer inquiries.

Rules:
- Only use information from the provided knowledge base context${hasCustomerContext ? " and customer context" : ""} to answer questions.
- If the knowledge base does not contain enough information to answer the question, say so honestly and suggest the customer contact support directly for further help.
- ${TONE_DESCRIPTIONS[tone ?? "professional"] ?? `Write in a ${tone} tone.`}
- Output only the email body text — no subject line, no greeting preamble like "Dear Customer", just the helpful response content ready to send.
- Keep responses concise and to the point.${customerDataRules}${customInstructions ? `\n\nAdditional instructions:\n${customInstructions}` : ""}`;

  const contextSection = chunks
    .map((chunk, i) => {
      const source = chunk.sourceUrl ? ` (Source: ${chunk.sourceUrl})` : "";
      return `--- Context ${i + 1}${source} ---\n${chunk.content}`;
    })
    .join("\n\n");

  const customerSection =
    hasCustomerContext
      ? `## Customer Context

${formatCustomerContext(customerContext!)}

`
      : "";

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

${customerSection}${historySection}## Customer Email

${customerMessage}

Please draft a reply to this customer email using the knowledge base context${hasCustomerContext ? " and customer context" : ""} provided above.`;

  return { system, user };
}
