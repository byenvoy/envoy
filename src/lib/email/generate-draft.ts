import { createAdminClient } from "@/lib/supabase/admin";
import { retrieveAndDraft } from "@/lib/rag/retrieve";

export async function generateDraftForConversation(conversationId: string): Promise<void> {
  const admin = createAdminClient();

  // Fetch conversation
  const { data: conversation, error: convoError } = await admin
    .from("conversations")
    .select("*, organizations!inner(name)")
    .eq("id", conversationId)
    .single();

  if (convoError || !conversation) throw convoError ?? new Error("Conversation not found");

  // Fetch all messages in the conversation, ordered chronologically
  const { data: messages } = await admin
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (!messages || messages.length === 0) throw new Error("No messages in conversation");

  // Build conversation history from all messages except the latest inbound
  const latestMessage = messages[messages.length - 1];
  const priorMessages = messages.slice(0, -1);

  const conversationHistory: { role: "customer" | "agent"; content: string }[] = [];
  for (const msg of priorMessages) {
    if (msg.body_text) {
      conversationHistory.push({
        role: msg.direction === "inbound" ? "customer" : "agent",
        content: msg.body_text,
      });
    }
  }

  const companyName = conversation.organizations?.name ?? "Our Company";
  const customerMessage = latestMessage.body_text ?? conversation.subject ?? "";

  const result = await retrieveAndDraft({
    supabase: admin,
    orgId: conversation.org_id,
    companyName,
    customerMessage,
    customerEmail: conversation.customer_email,
    conversationHistory: conversationHistory.length > 0 ? conversationHistory : undefined,
  });

  // Insert draft
  const { error: draftError } = await admin.from("drafts").insert({
    conversation_id: conversationId,
    org_id: conversation.org_id,
    draft_content: result.draft,
    model_used: result.model,
    chunks_used: result.chunks.map((c) => ({
      id: c.id,
      content: c.content,
      similarity: c.similarity,
      source_url: c.source_url,
    })),
    customer_context: result.customerContext ?? null,
    classification_result: result.classification ?? null,
  });

  if (draftError) throw draftError;
}
