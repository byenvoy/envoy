import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

  const { data: org } = await supabase
    .from("organizations")
    .select("onboarding_step, onboarding_completed_at")
    .eq("id", profile.org_id)
    .single();

  return NextResponse.json({
    step: org?.onboarding_step ?? 1,
    completedAt: org?.onboarding_completed_at ?? null,
  });
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
    .select("org_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const { step } = await request.json();
  if (typeof step !== "number" || step < 1 || step > 4) {
    return NextResponse.json({ error: "Invalid step" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {
    onboarding_step: step,
  };

  if (step === 4) {
    updates.onboarding_completed_at = new Date().toISOString();
  }

  // Only advance, never go backward in persisted step
  const { data: org } = await supabase
    .from("organizations")
    .select("onboarding_step")
    .eq("id", profile.org_id)
    .single();

  if (org && step <= org.onboarding_step) {
    return NextResponse.json({ ok: true });
  }

  const { error } = await supabase
    .from("organizations")
    .update(updates)
    .eq("id", profile.org_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
