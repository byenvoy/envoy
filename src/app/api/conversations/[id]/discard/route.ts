import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/db/helpers";
import { db } from "@/lib/db";
import { drafts, autopilotEvaluations } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await withAuth();
  if (!auth.success) return auth.response;
  const { orgId } = auth.context;

  // Discard latest pending draft
  const draft = await db
    .select({ id: drafts.id, autopilotEvaluationId: drafts.autopilotEvaluationId })
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
    .then((r) => r[0] ?? null);

  if (draft) {
    await db
      .update(drafts)
      .set({ status: "discarded" })
      .where(eq(drafts.id, draft.id));

    // Record shadow mode discard
    if (draft.autopilotEvaluationId) {
      await db
        .update(autopilotEvaluations)
        .set({ humanAction: "discarded" })
        .where(eq(autopilotEvaluations.id, draft.autopilotEvaluationId));
    }
  }

  // Conversation stays open — agent can still respond manually or regenerate
  return NextResponse.json({ ok: true });
}
