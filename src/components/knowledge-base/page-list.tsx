import type { KnowledgeBasePage } from "@/lib/types/database";
import { PageCard } from "./page-card";

interface PageListProps {
  pages: KnowledgeBasePage[];
}

export function PageList({ pages }: PageListProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {pages.map((page) => (
        <PageCard key={page.id} page={page} />
      ))}
    </div>
  );
}
