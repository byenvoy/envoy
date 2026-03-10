import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
    .select("org_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const body = await request.json();
  const { edited_content } = body;

  if (!edited_content || typeof edited_content !== "string") {
    return NextResponse.json(
      { error: "edited_content is required" },
      { status: 400 }
    );
  }

  // Get latest draft for this ticket
  const { data: draft } = await supabase
    .from("draft_replies")
    .select("id")
    .eq("ticket_id", id)
    .eq("org_id", profile.org_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!draft) {
    return NextResponse.json({ error: "No draft found" }, { status: 404 });
  }

  const { error } = await supabase
    .from("draft_replies")
    .update({ edited_content })
    .eq("id", draft.id);

  if (error) {
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
