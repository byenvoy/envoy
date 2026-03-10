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

  // Get latest draft
  const { data: draft } = await supabase
    .from("draft_replies")
    .select("id")
    .eq("ticket_id", id)
    .eq("org_id", profile.org_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (draft) {
    await supabase
      .from("draft_replies")
      .update({ was_approved: false })
      .eq("id", draft.id);
  }

  const { error } = await supabase
    .from("tickets")
    .update({ status: "discarded" })
    .eq("id", id)
    .eq("org_id", profile.org_id);

  if (error) {
    return NextResponse.json({ error: "Failed to discard" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
