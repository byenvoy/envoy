import { createShopifyClient } from "@/lib/integrations/shopify-client-factory";
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/db/helpers";
import { db } from "@/lib/db";
import { conversations, messages, drafts, autopilotEvaluations } from "@/lib/db/schema";
import { eq, and, desc, asc } from "drizzle-orm";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await withAuth();
  if (!auth.success) return auth.response;
  const { orgId } = auth.context;

  // Fetch conversation
  const conversation = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.orgId, orgId)))
    .then((r) => r[0]);

  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Fetch all messages in chronological order
  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(asc(messages.createdAt));

  // Fetch latest pending draft
  const draft = await db
    .select()
    .from(drafts)
    .where(and(eq(drafts.conversationId, id), eq(drafts.status, "pending")))
    .orderBy(desc(drafts.createdAt))
    .limit(1)
    .then((r) => r[0] ?? null);

  // Fetch autopilot evaluation separately if draft has one
  let autopilotEvaluation = null;
  if (draft?.autopilotEvaluationId) {
    autopilotEvaluation = await db
      .select({
        gate3_passed: autopilotEvaluations.gate3Passed,
        gate3_needs_human_reason: autopilotEvaluations.gate3NeedsHumanReason,
        outcome: autopilotEvaluations.outcome,
      })
      .from(autopilotEvaluations)
      .where(eq(autopilotEvaluations.id, draft.autopilotEvaluationId))
      .then((r) => r[0] ?? null);
  }

  // Fetch Shopify customer context independently (if Shopify is connected)
  let shopifyCustomer = null;
  try {
    const shopifyClient = await createShopifyClient(orgId);
    if (shopifyClient) {
      shopifyCustomer = await shopifyClient.getCustomerContext(
        conversation.customerEmail
      );
    }
  } catch {
    // Shopify lookup failed — not critical, continue without it
  }

  const draftSnake = draft
    ? {
        id: draft.id,
        conversation_id: draft.conversationId,
        org_id: draft.orgId,
        message_id: draft.messageId,
        draft_content: draft.draftContent,
        edited_content: draft.editedContent,
        status: draft.status,
        model_used: draft.modelUsed,
        chunks_used: draft.chunksUsed,
        customer_context: draft.customerContext,
        classification_result: draft.classificationResult,
        approved_at: draft.approvedAt,
        approved_by: draft.approvedBy,
        autopilot_evaluation_id: draft.autopilotEvaluationId,
        sent_by_autopilot: draft.sentByAutopilot,
        is_regeneration: draft.isRegeneration,
        created_at: draft.createdAt,
        autopilot_evaluation: autopilotEvaluation,
      }
    : null;

  return NextResponse.json({
    conversation: {
      id: conversation.id,
      org_id: conversation.orgId,
      subject: conversation.subject,
      status: conversation.status,
      customer_email: conversation.customerEmail,
      customer_name: conversation.customerName,
      autopilot_disabled: conversation.autopilotDisabled,
      created_at: conversation.createdAt,
      updated_at: conversation.updatedAt,
    },
    messages: msgs.map((m) => ({
      id: m.id,
      conversation_id: m.conversationId,
      org_id: m.orgId,
      direction: m.direction,
      from_email: m.fromEmail,
      from_name: m.fromName,
      to_email: m.toEmail,
      body_text: m.bodyText,
      body_html: m.bodyHtml,
      message_id: m.messageId,
      in_reply_to: m.inReplyTo,
      source: m.source,
      connection_id: m.connectionId,
      sent_by_autopilot: m.sentByAutopilot,
      created_at: m.createdAt,
    })),
    draft: draftSnake,
    shopifyCustomer,
  });
}
