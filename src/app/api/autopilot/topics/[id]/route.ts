import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { embedText } from "@/lib/rag/embeddings";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id, role")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  if (profile.role !== "owner") {
    return NextResponse.json({ error: "Only owners can manage autopilot" }, { status: 403 });
  }

  const body = await request.json();
  const { name, description, mode, confidence_threshold, daily_send_limit } = body;

  if (mode && !["off", "shadow", "auto"].includes(mode)) {
    return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
  }

  // Fetch current topic to check if description changed
  const { data: existing } = await supabase
    .from("autopilot_topics")
    .select("description")
    .eq("id", id)
    .eq("org_id", profile.org_id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Topic not found" }, { status: 404 });
  }

  const update: Record<string, unknown> = {};
  if (name !== undefined) update.name = name;
  if (description !== undefined) update.description = description;
  if (mode !== undefined) update.mode = mode;
  if (confidence_threshold !== undefined) update.confidence_threshold = confidence_threshold;
  if (daily_send_limit !== undefined) update.daily_send_limit = daily_send_limit;

  // Re-embed if description changed
  if (description && description !== existing.description) {
    try {
      const embedding = await embedText(description);
      update.embedding = JSON.stringify(embedding);
    } catch (error) {
      console.error("Failed to re-embed topic description:", error);
    }
  }

  const { error } = await supabase
    .from("autopilot_topics")
    .update(update)
    .eq("id", id)
    .eq("org_id", profile.org_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id, role")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  if (profile.role !== "owner") {
    return NextResponse.json({ error: "Only owners can manage autopilot" }, { status: 403 });
  }

  const { error } = await supabase
    .from("autopilot_topics")
    .delete()
    .eq("id", id)
    .eq("org_id", profile.org_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
