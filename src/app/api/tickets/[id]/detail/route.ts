import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
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
    return NextResponse.json({ error: "No profile" }, { status: 403 });
  }

  // Fetch ticket
  const { data: ticket } = await supabase
    .from("tickets")
    .select("*")
    .eq("id", id)
    .eq("org_id", profile.org_id)
    .single();

  if (!ticket) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Fetch latest draft
  const { data: draft } = await supabase
    .from("draft_replies")
    .select("*")
    .eq("ticket_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  // Fetch thread messages (excluding current ticket)
  const threadMessages: {
    id: string;
    from_email: string;
    from_name: string | null;
    body_text: string | null;
    created_at: string;
    is_agent_reply?: boolean;
    reply_content?: string;
  }[] = [];

  if (ticket.thread_id && ticket.thread_id !== ticket.id) {
    const { data: threadTickets } = await supabase
      .from("tickets")
      .select("id, from_email, from_name, body_text, status, created_at")
      .eq("thread_id", ticket.thread_id)
      .neq("id", id)
      .order("created_at", { ascending: true });

    if (threadTickets) {
      for (const t of threadTickets) {
        const msg = {
          id: t.id,
          from_email: t.from_email,
          from_name: t.from_name,
          body_text: t.body_text,
          created_at: t.created_at,
          is_agent_reply: false,
          reply_content: undefined as string | undefined,
        };

        if (t.status === "sent") {
          const { data: sentDraft } = await supabase
            .from("draft_replies")
            .select("edited_content, draft_content")
            .eq("ticket_id", t.id)
            .eq("was_approved", true)
            .single();

          if (sentDraft) {
            msg.is_agent_reply = true;
            msg.reply_content =
              sentDraft.edited_content ?? sentDraft.draft_content;
          }
        }

        threadMessages.push(msg);
      }
    }
  }

  return NextResponse.json({ ticket, draft, threadMessages });
}
