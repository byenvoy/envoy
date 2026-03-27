import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendReply } from "@/lib/email/send-reply";
import type { Conversation, Message } from "@/lib/types/database";

/** Simple word-level edit distance (Levenshtein on word arrays). */
function computeWordEditDistance(a: string, b: string): number {
  const wordsA = a.trim().split(/\s+/);
  const wordsB = b.trim().split(/\s+/);
  const m = wordsA.length;
  const n = wordsB.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = wordsA[i - 1] === wordsB[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

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

  // Fetch conversation
  const { data: conversation } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", id)
    .eq("org_id", profile.org_id)
    .single();

  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  // Fetch latest pending draft
  const { data: draft } = await supabase
    .from("drafts")
    .select("*")
    .eq("conversation_id", id)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!draft) {
    return NextResponse.json({ error: "No pending draft found" }, { status: 404 });
  }

  // Get latest inbound message for reply threading
  const { data: latestInbound } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", id)
    .eq("direction", "inbound")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!latestInbound) {
    return NextResponse.json({ error: "No inbound message found" }, { status: 404 });
  }

  // Check for edited content and close flag in request body
  const body = await request.json().catch(() => ({}));
  const editedContent = body.edited_content;
  const closeAfterSend = body.close === true;

  // Get org's email address and connection for sending
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

  // Find the connection ID from the latest inbound message
  const connectionId = latestInbound.connection_id;
  if (!connectionId) {
    return NextResponse.json(
      { error: "No email connection found for this conversation" },
      { status: 400 }
    );
  }

  const replyContent = editedContent ?? draft.edited_content ?? draft.draft_content;
  const replyHtml = replyContent.replace(/\n/g, "<br>");

  try {
    const outboundMessageId = await sendReply({
      conversation: conversation as Conversation,
      latestInboundMessage: latestInbound as Message,
      replyContent,
      replyHtml,
      emailAddr,
      connectionId,
    });

    // Update draft
    await supabase
      .from("drafts")
      .update({
        status: "approved",
        message_id: outboundMessageId,
        approved_at: new Date().toISOString(),
        approved_by: user.id,
        ...(editedContent ? { edited_content: editedContent } : {}),
      })
      .eq("id", draft.id);

    // Record shadow mode human action if this draft was evaluated by autopilot
    if (draft.autopilot_evaluation_id) {
      const wasEdited = !!(editedContent && editedContent !== draft.draft_content);
      const editDistance = wasEdited
        ? computeWordEditDistance(draft.draft_content, editedContent!)
        : 0;

      await supabase
        .from("autopilot_evaluations")
        .update({
          human_action: wasEdited ? "approved_with_edit" : "approved_no_edit",
          edit_distance: editDistance,
        })
        .eq("id", draft.autopilot_evaluation_id);
    }

    // If close requested, override the "waiting" status set by sendReply
    if (closeAfterSend) {
      await supabase
        .from("conversations")
        .update({ status: "closed" })
        .eq("id", id);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to send reply:", error);
    return NextResponse.json(
      { error: "Failed to send reply" },
      { status: 500 }
    );
  }
}
