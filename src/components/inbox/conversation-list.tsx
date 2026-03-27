import type { Conversation, ConversationStatus } from "@/lib/types/database";

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const seconds = Math.floor((now - then) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  activeFilter: string;
  onSelect: (id: string) => void;
}

export function ConversationList({ conversations, selectedId, activeFilter, onSelect }: ConversationListProps) {
  if (conversations.length === 0) {
    if (activeFilter === "open") {
      return (
        <div className="p-6 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-success-light">
            <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <p className="font-display text-sm font-semibold text-text-primary">All caught up!</p>
          <p className="mt-1 text-xs text-text-secondary">No open conversations need attention.</p>
        </div>
      );
    }
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-text-secondary">
          No conversations yet.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {conversations.map((convo) => {
        const isSelected = convo.id === selectedId;

        return (
          <button
            key={convo.id}
            onClick={() => onSelect(convo.id)}
            className={`w-full px-4 py-3 text-left transition-colors ${
              isSelected
                ? "bg-success-light"
                : "hover:bg-surface-alt"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-display text-sm font-semibold text-text-primary">
                {convo.customer_name || convo.customer_email}
              </span>
              <span className="flex-shrink-0 font-mono text-xs text-text-secondary">
                {timeAgo(convo.last_message_at)}
              </span>
            </div>
            <div className="mt-0.5 flex items-center justify-between gap-2">
              <p className="truncate text-sm text-text-primary">
                {convo.subject || "(no subject)"}
              </p>
              {activeFilter === "all" && (
                <StatusLabel status={convo.status} />
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

const statusLabelConfig: Record<ConversationStatus, { label: string; className: string }> = {
  open: { label: "Open", className: "bg-ai-accent-light text-ai-accent" },
  waiting: { label: "Waiting", className: "bg-success-light text-primary" },
  closed: { label: "Closed", className: "bg-surface-alt text-text-secondary" },
};

function StatusLabel({ status }: { status: ConversationStatus }) {
  const config = statusLabelConfig[status];
  return (
    <span className={`rounded px-1.5 py-0.5 font-display text-[10px] font-medium ${config.className}`}>
      {config.label}
    </span>
  );
}
