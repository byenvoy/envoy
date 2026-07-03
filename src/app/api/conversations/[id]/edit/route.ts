import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/db/helpers";
import { db } from "@/lib/db";
import { conversations, drafts, autopilotEvaluations } from "@/lib/db/schema";
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
    .select({
      id: drafts.id,
      modelUsed: drafts.modelUsed,
      autopilotEvaluationId: drafts.autopilotEvaluationId,
    })
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

  try {
    if (draft) {
      // Clearing all text removes the draft: manual drafts are deleted
      // outright (they were only ever a keystroke buffer); AI drafts are
      // discarded (status flip keeps the audit trail and shadow-mode
      // metrics, mirroring the explicit discard endpoint). Either way the
      // conversation returns to a blank compose.
      if (!edited_content.trim()) {
        if (draft.modelUsed === "manual") {
          await db.delete(drafts).where(eq(drafts.id, draft.id));
        } else {
          await db
            .update(drafts)
            .set({ status: "discarded" })
            .where(eq(drafts.id, draft.id));

          if (draft.autopilotEvaluationId) {
            await db
              .update(autopilotEvaluations)
              .set({ humanAction: "discarded" })
              .where(eq(autopilotEvaluations.id, draft.autopilotEvaluationId));
          }
        }
        return NextResponse.json({ ok: true, deleted: true });
      }

      await db
        .update(drafts)
        .set({ editedContent: edited_content })
        .where(eq(drafts.id, draft.id));
      return NextResponse.json({ ok: true, created: false });
    }

    // No pending draft — this is a manual compose autosave. Verify the
    // conversation belongs to the org, then create a pending manual draft
    // so typed text survives navigation.
    if (!edited_content.trim()) {
      return NextResponse.json({ ok: true, created: false });
    }

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
      editedContent: edited_content,
      modelUsed: "manual",
      status: "pending",
    });

    return NextResponse.json({ ok: true, created: true });
  } catch {
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
