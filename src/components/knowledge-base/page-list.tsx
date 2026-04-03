"use client";

import { useState, useMemo } from "react";
import type { KnowledgeBasePage } from "@/lib/types/database";
import { PageCard } from "./page-card";
import { PageToolbar, type SortOption } from "./page-toolbar";
import { useSyncingUrls } from "./use-syncing-urls";

interface PageListProps {
  pages: KnowledgeBasePage[];
}

export function PageList({ pages }: PageListProps) {
  const syncingUrls = useSyncingUrls();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("az");

  const filteredPages = useMemo(() => {
    let result = pages;

    if (search) {
      const query = search.toLowerCase();
      result = result.filter((p) =>
        (p.title ?? "").toLowerCase().includes(query)
      );
    }

    result = [...result].sort((a, b) => {
      switch (sort) {
        case "az":
          return (a.title ?? "").localeCompare(b.title ?? "");
        case "updated":
          return (
            new Date(b.updated_at).getTime() -
            new Date(a.updated_at).getTime()
          );
        case "added":
          return (
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime()
          );
      }
    });

    return result;
  }, [pages, search, sort]);

  return (
    <div>
      <PageToolbar
        search={search}
        sort={sort}
        onSearchChange={setSearch}
        onSortChange={setSort}
      />

      {filteredPages.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredPages.map((page) => (
            <PageCard
              key={page.id}
              page={page}
              syncing={!!page.url && syncingUrls.has(page.url)}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16">
          <p className="mb-1 text-sm font-medium font-display text-text-primary">
            No pages found
          </p>
          <p className="text-sm text-text-secondary">
            Try a different search term.
          </p>
        </div>
      )}
    </div>
  );
}
