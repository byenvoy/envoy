import type { Conversation } from "@/lib/types/database";

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
  onSelect: (id: string) => void;
}

export function ConversationList({ conversations, selectedId, onSelect }: ConversationListProps) {
  if (conversations.length === 0) {
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
        const isOpen = convo.status === "open";

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
              <span className="flex items-center gap-1.5 truncate font-display text-sm font-semibold text-text-primary">
                {isOpen && (
                  <span className="inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                )}
                {convo.customer_name || convo.customer_email}
              </span>
              <span className="flex-shrink-0 font-mono text-xs text-text-secondary">
                {timeAgo(convo.updated_at)}
              </span>
            </div>
            <p className="mt-0.5 truncate text-sm text-text-primary">
              {convo.subject || "(no subject)"}
            </p>
          </button>
        );
      })}
    </div>
  );
}
