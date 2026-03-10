import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { TicketDetail } from "@/components/inbox/ticket-detail";
import type { ThreadMessage } from "@/components/inbox/thread-view";

export default async function TicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/onboarding");

  // Fetch ticket
  const { data: ticket } = await supabase
    .from("tickets")
    .select("*")
    .eq("id", id)
    .eq("org_id", profile.org_id)
    .single();

  if (!ticket) notFound();

  // Fetch latest draft
  const { data: draft } = await supabase
    .from("draft_replies")
    .select("*")
    .eq("ticket_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  // Fetch thread messages (excluding current ticket)
  const threadMessages: ThreadMessage[] = [];
  if (ticket.thread_id && ticket.thread_id !== ticket.id) {
    const { data: threadTickets } = await supabase
      .from("tickets")
      .select("id, from_email, from_name, body_text, status, created_at")
      .eq("thread_id", ticket.thread_id)
      .neq("id", id)
      .order("created_at", { ascending: true });

    if (threadTickets) {
      for (const t of threadTickets) {
        const msg: ThreadMessage = {
          id: t.id,
          from_email: t.from_email,
          from_name: t.from_name,
          body_text: t.body_text,
          created_at: t.created_at,
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
            msg.reply_content = sentDraft.edited_content ?? sentDraft.draft_content;
          }
        }

        threadMessages.push(msg);
      }
    }
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/inbox"
          className="text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          &larr; Back to Inbox
        </Link>
      </div>
      <TicketDetail
        ticket={ticket}
        draft={draft}
        threadMessages={threadMessages}
      />
    </div>
  );
}
