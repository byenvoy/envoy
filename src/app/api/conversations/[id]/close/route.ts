import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/db/helpers";
import { db } from "@/lib/db";
import { conversations, drafts } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getPostHogClient } from "@/lib/posthog-server";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await withAuth();
  if (!auth.success) return auth.response;
  const { orgId } = auth.context;

  // Discard any pending drafts
  await db
    .update(drafts)
    .set({ status: "discarded" })
    .where(
      and(
        eq(drafts.conversationId, id),
        eq(drafts.orgId, orgId),
        eq(drafts.status, "pending")
      )
    );

  // Close the conversation
  try {
    await db
      .update(conversations)
      .set({ status: "closed" })
      .where(and(eq(conversations.id, id), eq(conversations.orgId, orgId)));
  } catch {
    return NextResponse.json({ error: "Failed to close" }, { status: 500 });
  }

  getPostHogClient().capture({
    distinctId: auth.context.userId,
    event: "conversation_closed",
    groups: { organization: orgId },
    properties: { org_id: orgId },
  });

  return NextResponse.json({ ok: true });
}
