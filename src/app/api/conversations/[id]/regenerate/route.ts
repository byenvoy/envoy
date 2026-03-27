import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/db/helpers";
import { db } from "@/lib/db";
import { conversations, drafts, autopilotEvaluations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { generateDraftForConversation } from "@/lib/email/generate-draft";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await withAuth();
  if (!auth.success) return auth.response;
  const { orgId } = auth.context;

  // Verify conversation belongs to user's org
  const conversation = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.orgId, orgId)))
    .then((r) => r[0]);

  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  // Discard any pending drafts first (keeps history for tracking)
  const pendingDrafts = await db
    .select({ id: drafts.id, autopilotEvaluationId: drafts.autopilotEvaluationId })
    .from(drafts)
    .where(
      and(eq(drafts.conversationId, id), eq(drafts.status, "pending"))
    );

  if (pendingDrafts.length > 0) {
    await db
      .update(drafts)
      .set({ status: "discarded" })
      .where(
        and(eq(drafts.conversationId, id), eq(drafts.status, "pending"))
      );

    // Record discard on autopilot evaluations
    for (const draft of pendingDrafts) {
      if (draft.autopilotEvaluationId) {
        await db
          .update(autopilotEvaluations)
          .set({ humanAction: "discarded" })
          .where(eq(autopilotEvaluations.id, draft.autopilotEvaluationId));
      }
    }
  }

  try {
    await generateDraftForConversation(id, true);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to regenerate draft:", error);
    return NextResponse.json(
      { error: "Failed to regenerate draft" },
      { status: 500 }
    );
  }
}
