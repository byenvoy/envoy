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
      <div className="relative flex gap-1.5">
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            if (!e.target.value && searchParams.has("search")) {
              const params = new URLSearchParams(searchParams.toString());
              params.delete("search");
              params.delete("id");
              router.push(`/inbox?${params.toString()}`);
            }
          }}
          onKeyDown={(e) => e.key === "Enter" && applySearch()}
          placeholder="Search..."
          className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-2.5 py-1.5 pr-7 text-xs text-text-primary placeholder:text-text-secondary focus:border-primary focus:outline-none"
        />
        {search && (
          <button
            onClick={() => {
              setSearch("");
              if (searchParams.has("search")) {
                const params = new URLSearchParams(searchParams.toString());
                params.delete("search");
                params.delete("id");
                router.push(`/inbox?${params.toString()}`);
              }
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
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
