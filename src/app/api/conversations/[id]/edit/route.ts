import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/db/helpers";
import { db } from "@/lib/db";
import { drafts } from "@/lib/db/schema";
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

  if (!edited_content || typeof edited_content !== "string") {
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

  if (!draft) {
    return NextResponse.json({ error: "No draft found" }, { status: 404 });
  }

  try {
    await db
      .update(drafts)
      .set({ editedContent: edited_content })
      .where(eq(drafts.id, draft.id));
  } catch {
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
