import { StatusBadge } from "./status-badge";
import { stripQuotedReply } from "@/lib/email/strip-quotes";
import type { Ticket, DraftReply } from "@/lib/types/database";

export interface ThreadMessage {
  id: string;
  from_email: string;
  from_name: string | null;
  body_text: string | null;
  created_at: string;
  is_agent_reply?: boolean;
  reply_content?: string;
}

interface ThreadPanelProps {
  ticket: Ticket;
  draft: DraftReply | null;
  threadMessages: ThreadMessage[];
}

export function ThreadPanel({ ticket, draft, threadMessages }: ThreadPanelProps) {
  const isSent = ticket.status === "sent";
  const sentContent = isSent
    ? draft?.edited_content ?? draft?.draft_content
    : null;

  return (
    <div>
      {/* Thread header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-lg font-bold tracking-tight text-text-primary">
            {ticket.subject || "(no subject)"}
          </h2>
          <StatusBadge status={ticket.status} />
        </div>
        <p className="mt-1 font-mono text-xs text-text-secondary">
          {ticket.from_name ? `${ticket.from_name} <${ticket.from_email}>` : ticket.from_email}
          {" \u00B7 "}
          {new Date(ticket.created_at).toLocaleString()}
        </p>
      </div>

      {/* Conversation thread — all messages in chronological order */}
      <div className="space-y-5">
        {/* Prior thread messages */}
        {threadMessages.map((msg) => (
          <div key={msg.id} className="space-y-3">
            <CustomerMessage
              name={msg.from_name || msg.from_email}
              email={msg.from_email}
              time={new Date(msg.created_at).toLocaleString()}
              body={msg.body_text ? stripQuotedReply(msg.body_text) : null}
            />
            {msg.is_agent_reply && msg.reply_content && (
              <AgentMessage
                replyTo={ticket.to_email}
                time=""
                body={msg.reply_content}
              />
            )}
          </div>
        ))}

        {/* Current customer message */}
        <CustomerMessage
          name={ticket.from_name || ticket.from_email}
          email={ticket.from_email}
          time={new Date(ticket.created_at).toLocaleString()}
          body={ticket.body_text ? stripQuotedReply(ticket.body_text) : null}
        />

        {/* Sent reply — shown inline as part of the conversation */}
        {isSent && sentContent && (
          <AgentMessage
            replyTo={ticket.to_email}
            time={draft?.approved_at ? new Date(draft.approved_at).toLocaleString() : ""}
            body={sentContent}
          />
        )}
      </div>
    </div>
  );
}

function CustomerMessage({
  name,
  email,
  time,
  body,
}: {
  name: string;
  email: string;
  time: string;
  body: string | null;
}) {
  return (
    <div className="flex gap-3">
      <div
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full font-display text-[10px] font-bold text-white"
        style={{ backgroundColor: "#7C6F64" }}
      >
        {getInitials(name !== email ? name : null, email)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-display text-sm font-semibold text-text-primary">
            {name}
          </span>
          <span className="font-mono text-xs text-text-secondary">{time}</span>
        </div>
        <div className="mt-1">
          <p className="whitespace-pre-wrap font-mono text-[13px] leading-relaxed text-text-primary">
            {body || "(empty)"}
          </p>
        </div>
      </div>
    </div>
  );
}

function AgentMessage({
  replyTo,
  time,
  body,
}: {
  replyTo: string;
  time: string;
  body: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary font-display text-[10px] font-bold text-white">
        E
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-display text-sm font-semibold text-primary">
            {replyTo}
          </span>
          {time && (
            <span className="font-mono text-xs text-text-secondary">{time}</span>
          )}
        </div>
        <div className="mt-1 rounded-lg border-l-[3px] border-primary bg-success-light px-4 py-3">
          <p className="whitespace-pre-wrap font-mono text-[13px] leading-relaxed text-text-primary">
            {body}
          </p>
        </div>
      </div>
    </div>
  );
}

function getInitials(name: string | null, email: string): string {
  if (name) {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  return email[0]?.toUpperCase() ?? "?";
}
