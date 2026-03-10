import Link from "next/link";
import { StatusBadge } from "./status-badge";
import type { Ticket } from "@/lib/types/database";

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const seconds = Math.floor((now - then) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function TicketList({ tickets }: { tickets: Ticket[] }) {
  if (tickets.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-800">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No tickets yet. Emails sent to your configured address will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white dark:divide-zinc-700 dark:border-zinc-700 dark:bg-zinc-800">
      {tickets.map((ticket) => (
        <Link
          key={ticket.id}
          href={`/inbox/${ticket.id}`}
          className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-750 sm:px-6"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                {ticket.from_name || ticket.from_email}
              </span>
              <StatusBadge status={ticket.status} />
            </div>
            <p className="mt-0.5 truncate text-sm text-zinc-500 dark:text-zinc-400">
              {ticket.subject || "(no subject)"}
            </p>
          </div>
          <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">
            {timeAgo(ticket.created_at)}
          </span>
        </Link>
      ))}
    </div>
  );
}
