import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  profiles,
  conversations,
  messages,
  drafts,
  autopilotEvaluations,
  autopilotTopics,
} from "@/lib/db/schema";
import { eq, and, desc, asc, or, ilike, sql, getTableColumns } from "drizzle-orm";
import { createShopifyClient } from "@/lib/integrations/shopify-client-factory";
import { parseSearch } from "@/lib/search/parse-search";
import { InboxView } from "@/components/inbox/inbox-view";
import type { Conversation, Message, Draft, ConversationStatus, MessageDirection, DraftStatus } from "@/lib/types/database";

const PAGE_SIZE = 50;

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string; id?: string }>;
}) {
  const { status: statusFilter, search, id: selectedId } = await searchParams;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const profile = await db
    .select({ orgId: profiles.orgId, role: profiles.role })
    .from(profiles)
    .where(eq(profiles.id, session.user.id))
    .then((r) => r[0]);

  if (!profile) redirect("/onboarding");

  const orgId = profile.orgId;

  // Build where conditions for conversations query
  const effectiveStatus = statusFilter ?? "open";
  const baseConditions = [eq(conversations.orgId, orgId)];

  if (effectiveStatus !== "all") {
    baseConditions.push(eq(conversations.status, effectiveStatus as ConversationStatus));
  }

  let searchFreeText: string | null = null;

  if (search) {
    const parsed = parseSearch(search);
    searchFreeText = parsed.freeText || null;

    // from: operator — narrow by sender email
    if (parsed.from) {
      baseConditions.push(ilike(conversations.customerEmail, `%${parsed.from}%`));
    }

    // Free-text: search metadata + message bodies
    if (parsed.freeText) {
      baseConditions.push(
        or(
          ilike(conversations.customerEmail, `%${parsed.freeText}%`),
          ilike(conversations.customerName, `%${parsed.freeText}%`),
          ilike(conversations.subject, `%${parsed.freeText}%`),
          sql`EXISTS (
            SELECT 1 FROM messages m
            WHERE m.conversation_id = ${conversations.id}
            AND to_tsvector('english', COALESCE(m.body_text, '')) @@ plainto_tsquery('english', ${parsed.freeText})
          )`
        )!
      );
    }
  }

  // Fetch conversations and all conversation statuses in parallel
  const snippetSelect = searchFreeText
    ? {
        ...getTableColumns(conversations),
        searchSnippet: sql<string | null>`(
          SELECT ts_headline('english', m.body_text,
            plainto_tsquery('english', ${searchFreeText}),
            'MaxWords=15, MinWords=8, MaxFragments=1, StartSel=<<HL>>, StopSel=<</HL>>'
          )
          FROM messages m
          WHERE m.conversation_id = "conversations"."id"
          AND to_tsvector('english', COALESCE(m.body_text, '')) @@ plainto_tsquery('english', ${searchFreeText})
          LIMIT 1
        )`,
      }
    : { ...getTableColumns(conversations), searchSnippet: sql<string | null>`NULL` };

  const [convoRows, allConvoRows, topicCount] = await Promise.all([
    db
      .select(snippetSelect)
      .from(conversations)
      .where(and(...baseConditions))
      .orderBy(desc(conversations.lastMessageAt))
      .limit(PAGE_SIZE),
    db
      .select({ status: conversations.status })
      .from(conversations)
      .where(eq(conversations.orgId, orgId)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(autopilotTopics)
      .where(eq(autopilotTopics.orgId, orgId))
      .then((r) => r[0]?.count ?? 0),
  ]);

  const counts: Record<string, number> = { all: allConvoRows.length };
  for (const c of allConvoRows) {
    counts[c.status] = (counts[c.status] ?? 0) + 1;
  }

  // Map conversations to snake_case
  const convoList = convoRows.map((c) => ({
    id: c.id,
    org_id: c.orgId,
    subject: c.subject,
    status: c.status,
    customer_email: c.customerEmail,
    customer_name: c.customerName,
    autopilot_disabled: c.autopilotDisabled,
    created_at: c.createdAt.toISOString(),
    updated_at: c.updatedAt.toISOString(),
    last_message_at: c.lastMessageAt.toISOString(),
    search_snippet: c.searchSnippet ?? null,
  }));

  const hasMore = convoList.length === PAGE_SIZE;

  // Prefetch selected (or first) conversation's detail to eliminate the waterfall
  let initialDetail = null;
  if (convoList.length > 0) {
    const firstId =
      selectedId && convoList.some((c) => c.id === selectedId)
        ? selectedId
        : convoList[0].id;

    const [messageRows, draftRow] = await Promise.all([
      db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, firstId))
        .orderBy(asc(messages.createdAt)),
      db
        .select()
        .from(drafts)
        .where(and(eq(drafts.conversationId, firstId), eq(drafts.status, "pending")))
        .orderBy(desc(drafts.createdAt))
        .limit(1)
        .then((r) => r[0] ?? null),
    ]);

    // Fetch autopilot evaluation separately if draft has one
    let autopilotEvaluation = null;
    if (draftRow?.autopilotEvaluationId) {
      autopilotEvaluation = await db
        .select({
          gate3Passed: autopilotEvaluations.gate3Passed,
          gate3NeedsHumanReason: autopilotEvaluations.gate3NeedsHumanReason,
          outcome: autopilotEvaluations.outcome,
        })
        .from(autopilotEvaluations)
        .where(eq(autopilotEvaluations.id, draftRow.autopilotEvaluationId))
        .then((r) => {
          const row = r[0];
          return row
            ? {
                gate3_passed: row.gate3Passed,
                gate3_needs_human_reason: row.gate3NeedsHumanReason,
                outcome: row.outcome,
              }
            : null;
        });
    }

    const selectedConvo =
      convoList.find((c) => c.id === firstId) ?? convoList[0];

    // Map messages to snake_case
    const messagesSnake: Message[] = messageRows.map((m) => ({
      id: m.id,
      conversation_id: m.conversationId,
      org_id: m.orgId,
      direction: m.direction as MessageDirection,
      from_email: m.fromEmail,
      from_name: m.fromName,
      to_email: m.toEmail,
      body_text: m.bodyText,
      body_html: m.bodyHtml,
      message_id: m.messageId,
      in_reply_to: m.inReplyTo,
      source: m.source as "imap" | "smtp" | "manual",
      connection_id: m.connectionId,
      sent_by_autopilot: m.sentByAutopilot,
      sent_at: m.sentAt.toISOString(),
      created_at: m.createdAt.toISOString(),
    }));

    // Map draft to snake_case
    const draftSnake: (Draft & { autopilot_evaluation: typeof autopilotEvaluation }) | null = draftRow
      ? {
          id: draftRow.id,
          conversation_id: draftRow.conversationId,
          org_id: draftRow.orgId,
          message_id: draftRow.messageId,
          draft_content: draftRow.draftContent,
          edited_content: draftRow.editedContent,
          status: draftRow.status as DraftStatus,
          model_used: draftRow.modelUsed,
          chunks_used: draftRow.chunksUsed as Draft["chunks_used"],
          customer_context: draftRow.customerContext as Draft["customer_context"],
          classification_result: draftRow.classificationResult as Draft["classification_result"],
          autopilot_evaluation_id: draftRow.autopilotEvaluationId,
          sent_by_autopilot: draftRow.sentByAutopilot,
          is_regeneration: draftRow.isRegeneration,
          approved_at: draftRow.approvedAt?.toISOString() ?? null,
          approved_by: draftRow.approvedBy,
          created_at: draftRow.createdAt.toISOString(),
          autopilot_evaluation: autopilotEvaluation,
        }
      : null;

    let shopifyCustomer = null;
    try {
      const shopifyClient = await createShopifyClient(orgId);
      if (shopifyClient) {
        shopifyCustomer = await shopifyClient.getCustomerContext(
          selectedConvo.customer_email
        );
      }
    } catch {
      // Not critical
    }

    initialDetail = {
      conversation: selectedConvo,
      messages: messagesSnake,
      draft: draftSnake,
      shopifyCustomer,
    };
  }

  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center"><p className="text-sm text-text-secondary">Loading inbox...</p></div>}>
      <InboxView
        conversations={convoList}
        statusCounts={counts}
        initialDetail={initialDetail}
        hasMore={hasMore}
        pageSize={PAGE_SIZE}
        showAutopilotNudge={topicCount === 0}
      />
    </Suspense>
  );
}
