import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateDraftForConversation } from "@/lib/email/generate-draft";

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

  // Verify conversation belongs to user's org
  const { data: conversation } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", id)
    .eq("org_id", profile.org_id)
    .single();

  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  // Discard any pending drafts first (keeps history for tracking)
  await supabase
    .from("drafts")
    .update({ status: "discarded" })
    .eq("conversation_id", id)
    .eq("status", "pending");

  try {
    await generateDraftForConversation(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to regenerate draft:", error);
    return NextResponse.json(
      { error: "Failed to regenerate draft" },
      { status: 500 }
    );
  }
}
