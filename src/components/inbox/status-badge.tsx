import type { ConversationStatus } from "@/lib/types/database";

const statusConfig: Record<ConversationStatus, { label: string; className: string }> = {
  open: {
    label: "Open",
    className: "bg-ai-accent-light text-ai-accent",
  },
  waiting: {
    label: "Waiting",
    className: "bg-success-light text-primary",
  },
  closed: {
    label: "Closed",
    className: "bg-surface-alt text-text-secondary",
  },
};

export function StatusBadge({ status }: { status: ConversationStatus }) {
  const config = statusConfig[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 font-display text-xs font-semibold ${config.className}`}
    >
      {config.label}
    </span>
  );
}
