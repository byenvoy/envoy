import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/db/helpers";
import { db } from "@/lib/db";
import { autopilotTopics } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { embedText } from "@/lib/rag/embeddings";

export async function GET() {
  const auth = await withAuth();
  if (!auth.success) return auth.response;
  const { orgId } = auth.context;

  try {
    const topics = await db
      .select({
        id: autopilotTopics.id,
        name: autopilotTopics.name,
        description: autopilotTopics.description,
        mode: autopilotTopics.mode,
        confidenceThreshold: autopilotTopics.confidenceThreshold,
        dailySendLimit: autopilotTopics.dailySendLimit,
        dailySendsToday: autopilotTopics.dailySendsToday,
        createdAt: autopilotTopics.createdAt,
        updatedAt: autopilotTopics.updatedAt,
      })
      .from(autopilotTopics)
      .where(eq(autopilotTopics.orgId, orgId))
      .orderBy(asc(autopilotTopics.createdAt));

    return NextResponse.json({
      topics: topics.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        mode: t.mode,
        confidence_threshold: t.confidenceThreshold,
        daily_send_limit: t.dailySendLimit,
        daily_sends_today: t.dailySendsToday,
        created_at: t.createdAt,
        updated_at: t.updatedAt,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await withAuth();
  if (!auth.success) return auth.response;
  const { orgId } = auth.context;

  const body = await request.json();
  const { name, description, mode, confidence_threshold, daily_send_limit } = body;

  if (!name || !description) {
    return NextResponse.json({ error: "Name and description are required" }, { status: 400 });
  }

  if (mode && !["off", "shadow", "auto"].includes(mode)) {
    return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
  }

  // Generate embedding for the topic description
  let embedding: number[] | null = null;
  try {
    embedding = await embedText(description);
  } catch (error) {
    console.error("Failed to embed topic description:", error);
  }

  try {
    const topic = await db
      .insert(autopilotTopics)
      .values({
        orgId,
        name,
        description,
        embedding: embedding ?? null,
        mode: mode ?? "off",
        confidenceThreshold: String(confidence_threshold ?? 0.95),
        dailySendLimit: daily_send_limit ?? 100,
      })
      .returning({
        id: autopilotTopics.id,
        name: autopilotTopics.name,
        description: autopilotTopics.description,
        mode: autopilotTopics.mode,
        confidenceThreshold: autopilotTopics.confidenceThreshold,
        dailySendLimit: autopilotTopics.dailySendLimit,
        createdAt: autopilotTopics.createdAt,
      })
      .then((r) => r[0]);

    return NextResponse.json({
      topic: {
        id: topic.id,
        name: topic.name,
        description: topic.description,
        mode: topic.mode,
        confidence_threshold: topic.confidenceThreshold,
        daily_send_limit: topic.dailySendLimit,
        created_at: topic.createdAt,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
