import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/db/helpers";
import { db } from "@/lib/db";
import { conversations, drafts } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await withAuth();
  if (!auth.success) return auth.response;
  const { orgId } = auth.context;

  const body = await request.json();
  const { edited_content } = body;

  if (typeof edited_content !== "string") {
    return NextResponse.json(
      { error: "edited_content is required" },
      { status: 400 }
    );
  }

  // Get latest pending draft for this conversation
  const draft = await db
    .select({ id: drafts.id })
    .from(drafts)
    .where(
      and(
        eq(drafts.conversationId, id),
        eq(drafts.orgId, orgId),
        eq(drafts.status, "pending")
      )
    )
    .orderBy(desc(drafts.createdAt))
    .limit(1)
    .then((r) => r[0]);

  // Update existing draft, or upsert a manual draft for conversations that
  // never had one (e.g. marketing/automated mail where Envoy skipped auto-draft).
  try {
    if (draft) {
      await db
        .update(drafts)
        .set({ editedContent: edited_content })
        .where(eq(drafts.id, draft.id));
      return NextResponse.json({ ok: true, created: false });
    }

    // Verify conversation belongs to this org before creating a draft.
    const conv = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(and(eq(conversations.id, id), eq(conversations.orgId, orgId)))
      .then((r) => r[0]);

    if (!conv) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    await db.insert(drafts).values({
      conversationId: id,
      orgId,
      draftContent: edited_content,
      modelUsed: "manual",
      status: "pending",
    });

    return NextResponse.json({ ok: true, created: true });
  } catch {
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
