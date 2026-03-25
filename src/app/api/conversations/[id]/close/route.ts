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

  // Discard any pending drafts
  await supabase
    .from("drafts")
    .update({ status: "discarded" })
    .eq("conversation_id", id)
    .eq("org_id", profile.org_id)
    .eq("status", "pending");

  // Close the conversation
  const { error } = await supabase
    .from("conversations")
    .update({ status: "closed" })
    .eq("id", id)
    .eq("org_id", profile.org_id);

  if (error) {
    return NextResponse.json({ error: "Failed to close" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
