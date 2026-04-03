"use client";

import { useState } from "react";

export type SortOption = "az" | "updated" | "added";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "az", label: "A–Z" },
  { value: "updated", label: "Recently Updated" },
  { value: "added", label: "Recently Added" },
];

interface PageToolbarProps {
  search: string;
  sort: SortOption;
  onSearchChange: (value: string) => void;
  onSortChange: (value: SortOption) => void;
}

export function PageToolbar({
  search,
  sort,
  onSearchChange,
  onSortChange,
}: PageToolbarProps) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search knowledge base..."
          className="w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 pr-7 text-xs text-text-primary placeholder:text-text-secondary focus:border-primary focus:outline-none sm:w-64"
        />
        {search && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>

      <div className="flex gap-0.5">
        {SORT_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => onSortChange(option.value)}
            className={`whitespace-nowrap rounded-full px-2 py-0.5 font-display text-[11px] font-medium transition-colors ${
              sort === option.value
                ? "bg-primary text-white"
                : "bg-surface text-text-secondary hover:bg-border"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
