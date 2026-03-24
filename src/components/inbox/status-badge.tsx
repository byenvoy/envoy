import type { TicketStatus } from "@/lib/types/database";

const statusConfig: Record<TicketStatus, { label: string; className: string }> = {
  new: {
    label: "New",
    className: "bg-info-light text-info",
  },
  draft_generated: {
    label: "Draft Ready",
    className: "bg-ai-accent-light text-ai-accent",
  },
  approved: {
    label: "Approved",
    className: "bg-success-light text-primary",
  },
  sent: {
    label: "Sent",
    className: "bg-success-light text-primary",
  },
  discarded: {
    label: "Discarded",
    className: "bg-surface-alt text-text-secondary",
  },
};

export function StatusBadge({ status }: { status: TicketStatus }) {
  const config = statusConfig[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 font-display text-xs font-semibold ${config.className}`}
    >
      {config.label}
    </span>
  );
}
