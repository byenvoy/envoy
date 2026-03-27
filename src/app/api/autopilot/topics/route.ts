import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { embedText } from "@/lib/rag/embeddings";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const { data: topics, error } = await supabase
    .from("autopilot_topics")
    .select("id, name, description, mode, confidence_threshold, daily_send_limit, daily_sends_today, created_at, updated_at")
    .eq("org_id", profile.org_id)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ topics });
}

export async function POST(request: NextRequest) {
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

  const { data: topic, error } = await supabase
    .from("autopilot_topics")
    .insert({
      org_id: profile.org_id,
      name,
      description,
      embedding: embedding ? JSON.stringify(embedding) : null,
      mode: mode ?? "off",
      confidence_threshold: confidence_threshold ?? 0.95,
      daily_send_limit: daily_send_limit ?? 100,
    })
    .select("id, name, description, mode, confidence_threshold, daily_send_limit, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ topic });
}
