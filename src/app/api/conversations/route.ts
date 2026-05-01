import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/db/helpers";
import { db } from "@/lib/db";
import { conversations, messages, drafts } from "@/lib/db/schema";
import { eq, and, or, not, desc, ilike, sql, getTableColumns } from "drizzle-orm";
import { parseSearch } from "@/lib/search/parse-search";
import type { ConversationStatus } from "@/lib/types/database";

export async function GET(request: NextRequest) {
  const auth = await withAuth();
  if (!auth.success) return auth.response;
  const { orgId } = auth.context;

  const params = request.nextUrl.searchParams;
  const status = params.get("status");
  const search = params.get("search");
  const offset = parseInt(params.get("offset") ?? "0", 10);
  const limit = parseInt(params.get("limit") ?? "50", 10);

  const conditions = [eq(conversations.orgId, orgId)];

  if (status && status !== "all") {
    conditions.push(eq(conversations.status, status as ConversationStatus));
  }

  // Hide conversations stuck in the draft-generation race window:
  // status='open' (last inbound, awaiting our response) but no pending draft
  // exists yet. These appear once the draft completes — usually within seconds.
  // Status 'waiting'/'closed' are unaffected. Conversations whose latest
  // message is automated (marketing/list mail) are also kept visible — they
  // intentionally don't get a draft.
  conditions.push(
    or(
      not(eq(conversations.status, "open")),
      sql`EXISTS (SELECT 1 FROM ${drafts} d WHERE d.conversation_id = ${conversations.id} AND d.status = 'pending')`,
      sql`(SELECT m.is_automated FROM ${messages} m WHERE m.conversation_id = ${conversations.id} ORDER BY m.created_at DESC LIMIT 1) = TRUE`
    )!
  );

  let searchFreeText: string | null = null;

  if (search) {
    const parsed = parseSearch(search);
    searchFreeText = parsed.freeText || null;

    // from: operator — filter by sender email
    if (parsed.from) {
      conditions.push(ilike(conversations.customerEmail, `%${parsed.from}%`));
    }

    // Free-text: search metadata + message bodies
    if (parsed.freeText) {
      conditions.push(
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

  const rows = await db
    .select(snippetSelect)
    .from(conversations)
    .where(and(...conditions))
    .orderBy(desc(conversations.lastMessageAt))
    .offset(offset)
    .limit(limit);

  return NextResponse.json({
    conversations: rows.map((c) => ({
      id: c.id,
      org_id: c.orgId,
      subject: c.subject,
      status: c.status,
      customer_email: c.customerEmail,
      customer_name: c.customerName,
      autopilot_disabled: c.autopilotDisabled,
      created_at: c.createdAt,
      updated_at: c.updatedAt,
      last_message_at: c.lastMessageAt,
      search_snippet: c.searchSnippet ?? null,
    })),
  });
}
