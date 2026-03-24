import { StatusBadge } from "./status-badge";
import type { Ticket } from "@/lib/types/database";

export interface ThreadMessage {
  id: string;
  from_email: string;
  from_name: string | null;
  body_text: string | null;
  created_at: string;
  is_agent_reply?: boolean;
  reply_content?: string;
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

interface ThreadPanelProps {
  ticket: Ticket;
  threadMessages: ThreadMessage[];
}

export function ThreadPanel({ ticket, threadMessages }: ThreadPanelProps) {
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

      {/* Thread history */}
      {threadMessages.length > 0 && (
        <div className="mb-6 space-y-4">
          {threadMessages.map((msg) => (
            <div key={msg.id}>
              <MessageBubble
                initials={getInitials(msg.from_name, msg.from_email)}
                name={msg.from_name || msg.from_email}
                time={new Date(msg.created_at).toLocaleString()}
                body={msg.body_text}
                avatarColor="#7C6F64"
              />
              {msg.is_agent_reply && msg.reply_content && (
                <div className="ml-9 mt-2">
                  <div className="rounded-lg border-l-3 border-primary bg-success-light px-4 py-3">
                    <div className="mb-1 font-display text-xs font-semibold text-primary">
                      Agent Reply
                    </div>
                    <p className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-text-primary">
                      {msg.reply_content}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Current message */}
      <MessageBubble
        initials={getInitials(ticket.from_name, ticket.from_email)}
        name={ticket.from_name || ticket.from_email}
        time={new Date(ticket.created_at).toLocaleString()}
        body={ticket.body_text}
        avatarColor="#7C6F64"
      />
    </div>
  );
}

function MessageBubble({
  initials,
  name,
  time,
  body,
  avatarColor,
}: {
  initials: string;
  name: string;
  time: string;
  body: string | null;
  avatarColor: string;
}) {
  return (
    <div className="flex gap-3">
      <div
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full font-display text-[10px] font-bold text-white"
        style={{ backgroundColor: avatarColor }}
      >
        {initials}
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
