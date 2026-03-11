import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const VALID_TONES = ["professional", "casual", "technical", "friendly"];

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

  const { tone, custom_instructions } = await request.json();

  if (tone && !VALID_TONES.includes(tone)) {
    return NextResponse.json({ error: "Invalid tone" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (tone) update.tone = tone;
  if (custom_instructions !== undefined) update.custom_instructions = custom_instructions;

  const { error } = await supabase
    .from("organizations")
    .update(update)
    .eq("id", profile.org_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
