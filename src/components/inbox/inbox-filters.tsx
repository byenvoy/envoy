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
  const activeFilter = searchParams.get("status") ?? "all";

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
    if (status === "all") {
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

      <div className="flex flex-wrap gap-1">
        {STATUS_FILTERS.map((filter) => {
          const count = statusCounts[filter.value] ?? 0;
          const isActive = activeFilter === filter.value;

          return (
            <button
              key={filter.value}
              onClick={() => setStatus(filter.value)}
              className={`rounded-full px-2 py-0.5 font-display text-xs font-medium transition-colors ${
                isActive
                  ? "bg-primary text-white"
                  : "bg-surface text-text-secondary hover:bg-border"
              }`}
            >
              {filter.label}
              {count > 0 && (
                <span className="ml-1 opacity-70">{count}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
