import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/db/helpers";
import { db } from "@/lib/db";
import { autopilotTopics } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { embedText } from "@/lib/rag/embeddings";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await withAuth();
  if (!auth.success) return auth.response;
  const { orgId, role } = auth.context;

  if (role !== "owner") {
    return NextResponse.json({ error: "Only owners can manage autopilot" }, { status: 403 });
  }

  const body = await request.json();
  const { name, description, mode, confidence_threshold, daily_send_limit } = body;

  if (mode && !["off", "shadow", "auto"].includes(mode)) {
    return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
  }

  // Fetch current topic to check if description changed
  const existing = await db
    .select({ description: autopilotTopics.description })
    .from(autopilotTopics)
    .where(and(eq(autopilotTopics.id, id), eq(autopilotTopics.orgId, orgId)))
    .then((r) => r[0]);

  if (!existing) {
    return NextResponse.json({ error: "Topic not found" }, { status: 404 });
  }

  const update: Record<string, unknown> = {};
  if (name !== undefined) update.name = name;
  if (description !== undefined) update.description = description;
  if (mode !== undefined) update.mode = mode;
  if (confidence_threshold !== undefined) update.confidenceThreshold = String(confidence_threshold);
  if (daily_send_limit !== undefined) update.dailySendLimit = daily_send_limit;

  // Re-embed if description changed
  if (description && description !== existing.description) {
    try {
      const embedding = await embedText(description);
      update.embedding = embedding;
    } catch (error) {
      console.error("Failed to re-embed topic description:", error);
    }
  }

  try {
    await db
      .update(autopilotTopics)
      .set(update)
      .where(and(eq(autopilotTopics.id, id), eq(autopilotTopics.orgId, orgId)));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await withAuth();
  if (!auth.success) return auth.response;
  const { orgId, role } = auth.context;

  if (role !== "owner") {
    return NextResponse.json({ error: "Only owners can manage autopilot" }, { status: 403 });
  }

  try {
    await db
      .delete(autopilotTopics)
      .where(and(eq(autopilotTopics.id, id), eq(autopilotTopics.orgId, orgId)));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
