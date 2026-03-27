import { createAdminClient } from "@/lib/supabase/admin";
import { retrieveAndDraft } from "@/lib/rag/retrieve";
import { runAutopilotPipeline } from "@/lib/autopilot/pipeline";
import { autoSendDraft } from "@/lib/autopilot/auto-send";
import { classifyTopic } from "@/lib/autopilot/gates/classify-topic";
import type { TopicClassificationResult } from "@/lib/autopilot/types";
import type { AutopilotTopic } from "@/lib/types/database";

export async function generateDraftForConversation(conversationId: string, isRegeneration = false): Promise<void> {
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

  // Run Gate 1 (topic classification) before draft generation
  // so we only inject the constrained prompt for autopilot-eligible emails
  let gate1Result: TopicClassificationResult | null = null;
  let activeTopics: AutopilotTopic[] = [];

  // Check if conversation has autopilot disabled (per-thread escalation)
  const isEscalated = conversation.autopilot_disabled === true;

  if (!isEscalated) {
    const { data: topics } = await admin
      .from("autopilot_topics")
      .select("*")
      .eq("org_id", conversation.org_id)
      .in("mode", ["shadow", "auto"]);

    activeTopics = (topics as AutopilotTopic[]) ?? [];

    if (activeTopics.length > 0) {
      try {
        gate1Result = await classifyTopic({
          customerMessage,
          conversationHistory: conversationHistory.length > 0 ? conversationHistory : undefined,
          topics: activeTopics,
          model: "claude-haiku-4-5-20251001",
          orgId: conversation.org_id,
        });
      } catch (error) {
        console.error("Gate 1 classification failed:", error);
      }
    }
  }

  const result = await retrieveAndDraft({
    supabase: admin,
    orgId: conversation.org_id,
    companyName,
    customerMessage,
    customerEmail: conversation.customer_email,
    conversationHistory: conversationHistory.length > 0 ? conversationHistory : undefined,
    injectConstrainedPrompt: gate1Result?.passed === true,
  });

  // Strip NEEDS_HUMAN_REVIEW flag from draft content if present.
  // The flag is captured by Gate 3 in the autopilot pipeline — we don't want it
  // stored as sendable draft content. Tolerant of markdown bold formatting.
  const cleanedDraft = result.draft.replace(/\n?\*{0,2}NEEDS_HUMAN_REVIEW\*{0,2}:.*$/m, "").trim();

  // Insert draft and get its ID
  const { data: insertedDraft, error: draftError } = await admin
    .from("drafts")
    .insert({
      conversation_id: conversationId,
      org_id: conversation.org_id,
      draft_content: cleanedDraft,
      model_used: result.model,
      chunks_used: result.chunks.map((c) => ({
        id: c.id,
        content: c.content,
        similarity: c.similarity,
        source_url: c.source_url,
      })),
      customer_context: result.customerContext ?? null,
      classification_result: result.classification ?? null,
      is_regeneration: isRegeneration,
    })
    .select("id")
    .single();

  if (draftError) throw draftError;

  // Run autopilot pipeline
  try {
    const autopilotResult = await runAutopilotPipeline(admin, {
      orgId: conversation.org_id,
      conversationId,
      draftId: insertedDraft.id,
      customerMessage,
      conversationHistory: conversationHistory.length > 0 ? conversationHistory : undefined,
      draftContent: result.draft,
      messageEmbedding: result.messageEmbedding,
      chunks: result.chunks,
      customerContext: result.customerContext,
      model: result.model,
      gate1Result: gate1Result ?? undefined,
      activeTopics,
    });

    if (autopilotResult) {
      // Tag the draft with the evaluation
      await admin
        .from("drafts")
        .update({
          autopilot_evaluation_id: autopilotResult.evaluationId || null,
          sent_by_autopilot: autopilotResult.shouldAutoSend,
        })
        .eq("id", insertedDraft.id);

      // Auto-send if all gates passed and mode is auto
      if (autopilotResult.shouldAutoSend && autopilotResult.topicMatch) {
        await autoSendDraft({
          supabase: admin,
          conversationId,
          draftId: insertedDraft.id,
          draftContent: result.draft,
          orgId: conversation.org_id,
          topicId: autopilotResult.topicMatch.id,
        });
      }
    }
  } catch (error) {
    // Autopilot failure should never prevent draft creation
    console.error("Autopilot pipeline error (draft still created):", error);
  }
}
