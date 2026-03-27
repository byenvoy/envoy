"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "waiting", label: "Waiting" },
  { value: "closed", label: "Closed" },
];

interface InboxFiltersProps {
  statusCounts: Record<string, number>;
}

export function InboxFilters({ statusCounts }: InboxFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const activeFilter = searchParams.get("status") ?? "open";

  function applySearch() {
    const params = new URLSearchParams(searchParams.toString());
    if (search) {
      params.set("search", search);
    } else {
      params.delete("search");
    }
    params.delete("id");
    router.push(`/inbox?${params.toString()}`);
  }

  function setStatus(status: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (status === "open") {
      params.delete("status");
    } else {
      params.set("status", status);
    }
    params.delete("id");
    router.push(`/inbox?${params.toString()}`);
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && applySearch()}
          placeholder="Search..."
          className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-secondary focus:border-primary focus:outline-none"
        />
      </div>

      <div className="flex min-w-0 gap-0.5">
        {STATUS_FILTERS.map((filter) => {
          const count = statusCounts[filter.value] ?? 0;
          const isActive = activeFilter === filter.value;
          const displayCount = count > 99 ? "99+" : count;

          return (
            <button
              key={filter.value}
              onClick={() => setStatus(filter.value)}
              className={`inline-flex items-baseline gap-0.5 whitespace-nowrap rounded-full px-1.5 py-0.5 font-display text-[11px] font-medium tabular-nums transition-colors ${
                isActive
                  ? "bg-primary text-white"
                  : "bg-surface text-text-secondary hover:bg-border"
              }`}
            >
              {filter.label}
              {count > 0 && (
                <span className="text-[9px] opacity-50">{displayCount}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
