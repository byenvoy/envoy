import type { SupabaseClient } from "@supabase/supabase-js";
import { sendReply } from "@/lib/email/send-reply";
import type { Conversation, Message } from "@/lib/types/database";

/**
 * Auto-send a draft reply, mirroring the manual approve flow.
 * Reuses the existing sendReply() infrastructure.
 */
export async function autoSendDraft({
  supabase,
  conversationId,
  draftId,
  draftContent,
  orgId,
  topicId,
}: {
  supabase: SupabaseClient;
  conversationId: string;
  draftId: string;
  draftContent: string;
  orgId: string;
  topicId: string;
}): Promise<void> {
  // Fetch conversation
  const { data: conversation } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .single();

  if (!conversation) throw new Error("Conversation not found for auto-send");

  // Fetch latest inbound message for reply threading
  const { data: latestInbound } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .eq("direction", "inbound")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!latestInbound) throw new Error("No inbound message found for auto-send");

  // Get org's email address
  const { data: emailAddr } = await supabase
    .from("email_addresses")
    .select("email_address, display_name")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .limit(1)
    .single();

  if (!emailAddr) throw new Error("No email address configured for auto-send");

  const connectionId = latestInbound.connection_id;
  if (!connectionId) throw new Error("No email connection found for auto-send");

  const replyHtml = draftContent.replace(/\n/g, "<br>");

  // Send via SMTP (same function as manual approve)
  const outboundMessageId = await sendReply({
    conversation: conversation as Conversation,
    latestInboundMessage: latestInbound as Message,
    replyContent: draftContent,
    replyHtml,
    emailAddr,
    connectionId,
    sentByAutopilot: true,
  });

  // Update draft status
  await supabase
    .from("drafts")
    .update({
      status: "approved",
      message_id: outboundMessageId,
      approved_at: new Date().toISOString(),
      approved_by: null,
      sent_by_autopilot: true,
    })
    .eq("id", draftId);

  // Atomic increment of daily send count with limit check
  await supabase.rpc("increment_autopilot_daily_sends", {
    topic_id: topicId,
  });
}
