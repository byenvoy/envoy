"use client";

import type { KnowledgeBasePage } from "@/lib/types/database";
import { PageCard } from "./page-card";
import { useSyncingUrls } from "./use-syncing-urls";

interface PageListProps {
  pages: KnowledgeBasePage[];
}

export function PageList({ pages }: PageListProps) {
  const syncingUrls = useSyncingUrls();

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {pages.map((page) => (
        <PageCard
          key={page.id}
          page={page}
          syncing={!!page.url && syncingUrls.has(page.url)}
        />
      ))}
    </div>
  );
}
