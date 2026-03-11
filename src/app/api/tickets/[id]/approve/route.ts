import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendReply } from "@/lib/email/send-reply";

export async function POST(
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

  // Fetch ticket
  const { data: ticket } = await supabase
    .from("tickets")
    .select("*")
    .eq("id", id)
    .eq("org_id", profile.org_id)
    .single();

  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  // Fetch latest draft
  const { data: draft } = await supabase
    .from("draft_replies")
    .select("*")
    .eq("ticket_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!draft) {
    return NextResponse.json({ error: "No draft found" }, { status: 404 });
  }

  // Check for edited content in request body
  const body = await request.json().catch(() => ({}));
  const editedContent = body.edited_content;

  // Get org's email address for sending
  const { data: emailAddr } = await supabase
    .from("email_addresses")
    .select("email_address, display_name")
    .eq("org_id", profile.org_id)
    .eq("is_active", true)
    .limit(1)
    .single();

  if (!emailAddr) {
    return NextResponse.json(
      { error: "No email address configured" },
      { status: 400 }
    );
  }

  const replyContent = editedContent ?? draft.edited_content ?? draft.draft_content;
  const replyHtml = replyContent.replace(/\n/g, "<br>");

  try {
    await sendReply(ticket, replyContent, replyHtml, emailAddr);

    // Update draft
    await supabase
      .from("draft_replies")
      .update({
        was_approved: true,
        approved_at: new Date().toISOString(),
        approved_by: user.id,
        ...(editedContent ? { edited_content: editedContent } : {}),
      })
      .eq("id", draft.id);

    // Update ticket status
    await supabase
      .from("tickets")
      .update({ status: "sent" })
      .eq("id", id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to send reply:", error);
    return NextResponse.json(
      { error: "Failed to send reply" },
      { status: 500 }
    );
  }
}
