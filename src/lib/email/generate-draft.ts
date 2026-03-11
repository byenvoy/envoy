import { createAdminClient } from "@/lib/supabase/admin";
import { retrieveAndDraft } from "@/lib/rag/retrieve";

export async function generateDraftForTicket(ticketId: string): Promise<void> {
  const admin = createAdminClient();

  // Fetch ticket
  const { data: ticket, error: ticketError } = await admin
    .from("tickets")
    .select("*, organizations!inner(name)")
    .eq("id", ticketId)
    .single();

  if (ticketError || !ticket) throw ticketError ?? new Error("Ticket not found");

  // Build conversation history from thread
  const conversationHistory: { role: "customer" | "agent"; content: string }[] = [];
  if (ticket.thread_id && ticket.thread_id !== ticket.id) {
    // Fetch all prior tickets in this thread
    const { data: threadTickets } = await admin
      .from("tickets")
      .select("id, from_email, to_email, body_text, status, created_at")
      .eq("thread_id", ticket.thread_id)
      .neq("id", ticketId)
      .order("created_at", { ascending: true });

    if (threadTickets) {
      for (const t of threadTickets) {
        // Customer message
        if (t.body_text) {
          conversationHistory.push({ role: "customer", content: t.body_text });
        }

        // If we sent a reply for this ticket, include it as agent message
        if (t.status === "sent") {
          const { data: draft } = await admin
            .from("draft_replies")
            .select("edited_content, draft_content")
            .eq("ticket_id", t.id)
            .eq("was_approved", true)
            .single();

          if (draft) {
            conversationHistory.push({
              role: "agent",
              content: draft.edited_content ?? draft.draft_content,
            });
          }
        }
      }
    }
  }

  const companyName = ticket.organizations?.name ?? "Our Company";
  const customerMessage = ticket.body_text ?? ticket.subject ?? "";

  const result = await retrieveAndDraft({
    supabase: admin,
    orgId: ticket.org_id,
    companyName,
    customerMessage,
    customerEmail: ticket.from_email,
    conversationHistory: conversationHistory.length > 0 ? conversationHistory : undefined,
  });

  // Insert draft reply
  const { error: draftError } = await admin.from("draft_replies").insert({
    ticket_id: ticketId,
    org_id: ticket.org_id,
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

  // Update ticket status
  await admin
    .from("tickets")
    .update({ status: "draft_generated" })
    .eq("id", ticketId);
}
