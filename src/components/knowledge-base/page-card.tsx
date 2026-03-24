"use client";

import { useState } from "react";
import Link from "next/link";
import type { KnowledgeBasePage } from "@/lib/types/database";

interface PageCardProps {
  page: KnowledgeBasePage;
}

export function PageCard({ page }: PageCardProps) {
  const [syncing, setSyncing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const preview = page.markdown_content
    ? page.markdown_content.slice(0, 150).replace(/[#*_\[\]]/g, "") + "..."
    : "No content";

  const updatedAt = new Date(page.updated_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  async function handleResync() {
    setSyncing(true);
    try {
      await fetch(`/api/knowledge-base/${page.id}/resync`, { method: "POST" });
      window.location.reload();
    } finally {
      setSyncing(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this page? Its chunks will be removed.")) return;
    setDeleting(true);
    try {
      await fetch(`/api/knowledge-base/${page.id}`, { method: "DELETE" });
      window.location.reload();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700">
      <h3 className="mb-1 truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
        {page.title || "Untitled"}
      </h3>
      {page.url ? (
        <a
          href={page.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-2 block truncate text-xs text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
        >
          {page.url}
        </a>
      ) : (
        <p className="mb-2 text-xs text-zinc-400 dark:text-zinc-500">
          {page.source === "upload" ? "File upload" : "Manual entry"}
        </p>
      )}
      <p className="mb-3 line-clamp-3 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
        {preview}
      </p>
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-400 dark:text-zinc-500">
          Updated {updatedAt}
        </p>
        <div className="flex items-center gap-2">
          <Link
            href={`/knowledge-base/${page.id}/edit`}
            className="text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            Edit
          </Link>
          {(page.source === "crawled" || page.source === "url") && page.url && (
            <button
              type="button"
              onClick={handleResync}
              disabled={syncing}
              className="text-xs text-zinc-500 hover:text-zinc-700 disabled:opacity-50 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              {syncing ? "Syncing..." : "Re-sync"}
            </button>
          )}
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50 dark:text-red-400 dark:hover:text-red-300"
          >
            {deleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
