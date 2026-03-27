import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
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
    .select("org_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Discard latest pending draft
  const { data: draft } = await supabase
    .from("drafts")
    .select("id, autopilot_evaluation_id")
    .eq("conversation_id", id)
    .eq("org_id", profile.org_id)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (draft) {
    await supabase
      .from("drafts")
      .update({ status: "discarded" })
      .eq("id", draft.id);

    // Record shadow mode discard
    if (draft.autopilot_evaluation_id) {
      await supabase
        .from("autopilot_evaluations")
        .update({ human_action: "discarded" })
        .eq("id", draft.autopilot_evaluation_id);
    }
  }

  // Conversation stays open — agent can still respond manually or regenerate
  return NextResponse.json({ ok: true });
}
