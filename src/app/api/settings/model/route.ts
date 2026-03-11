import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { SUPPORTED_MODELS } from "@/lib/rag/llm";

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
    return NextResponse.json({ error: "Only owners can change settings" }, { status: 403 });
  }

  const { model } = await request.json();
  if (!model || !SUPPORTED_MODELS[model]) {
    return NextResponse.json({ error: "Invalid model" }, { status: 400 });
  }

  const { error } = await supabase
    .from("organizations")
    .update({ preferred_model: model })
    .eq("id", profile.org_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
