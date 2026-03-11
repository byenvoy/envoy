import { createLLMProvider } from "./llm";
import type { ClassificationResult } from "@/lib/types/shopify";

export async function classifyTicket({
  customerMessage,
  customerEmail,
  hasShopifyIntegration,
}: {
  customerMessage: string;
  customerEmail?: string;
  hasShopifyIntegration: boolean;
}): Promise<ClassificationResult> {
  if (!hasShopifyIntegration) {
    return {
      query_type: "other",
      needs_customer_data: false,
      customer_email: customerEmail ?? null,
      order_identifier: null,
      reasoning: "No Shopify integration connected",
    };
  }

  const system = `You are a support ticket classifier. Analyze the customer message and determine if customer-specific data (orders, account info) is needed to answer it.

Output valid JSON with these fields:
- query_type: one of "order_status", "return_refund", "product_question", "account_issue", "general_policy", "other"
- needs_customer_data: boolean — true if answering requires looking up the customer's orders, account, or returns
- customer_email: the customer's email if identifiable, otherwise null
- order_identifier: a specific order number mentioned (e.g. "#1042"), otherwise null
- reasoning: one sentence explaining your classification

Output ONLY the JSON object, no markdown or extra text.`;

  const user = `Customer email: ${customerEmail ?? "unknown"}

Customer message:
${customerMessage}`;

  try {
    const llm = createLLMProvider();
    const raw = await llm.generateDraft(system, user);

    const cleaned = raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned) as ClassificationResult;

    return {
      query_type: parsed.query_type ?? "other",
      needs_customer_data: parsed.needs_customer_data ?? false,
      customer_email: parsed.customer_email ?? customerEmail ?? null,
      order_identifier: parsed.order_identifier ?? null,
      reasoning: parsed.reasoning ?? "",
    };
  } catch {
    return {
      query_type: "other",
      needs_customer_data: false,
      customer_email: customerEmail ?? null,
      order_identifier: null,
      reasoning: "Classification failed, falling back to KB-only",
    };
  }
}
