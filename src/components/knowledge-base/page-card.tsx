import type { KnowledgeBasePage } from "@/lib/types/database";

interface PageCardProps {
  page: KnowledgeBasePage;
}

export function PageCard({ page }: PageCardProps) {
  const preview = page.markdown_content
    ? page.markdown_content.slice(0, 150).replace(/[#*_\[\]]/g, "") + "..."
    : "No content";

  const updatedAt = new Date(page.updated_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700">
      <h3 className="mb-1 truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
        {page.title || "Untitled"}
      </h3>
      <a
        href={page.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mb-2 block truncate text-xs text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
      >
        {page.url}
      </a>
      <p className="mb-3 line-clamp-3 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
        {preview}
      </p>
      <p className="text-xs text-zinc-400 dark:text-zinc-500">
        Updated {updatedAt}
      </p>
    </div>
  );
}
