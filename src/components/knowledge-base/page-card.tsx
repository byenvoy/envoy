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
    <div className="rounded-lg border border-border bg-surface-alt p-4 transition-colors hover:border-border">
      <h3 className="mb-1 truncate text-sm font-medium font-display text-text-primary">
        {page.title || "Untitled"}
      </h3>
      {page.url ? (
        <a
          href={page.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-2 block truncate text-xs text-text-secondary hover:text-text-primary"
        >
          {page.url}
        </a>
      ) : (
        <p className="mb-2 text-xs text-text-secondary">
          {page.source === "upload" ? "File upload" : "Manual entry"}
        </p>
      )}
      <p className="mb-3 line-clamp-3 text-xs leading-relaxed text-text-secondary">
        {preview}
      </p>
      <div className="flex items-center justify-between">
        <p className="text-xs font-mono text-text-secondary">
          Updated {updatedAt}
        </p>
        <div className="flex items-center gap-2">
          <Link
            href={`/knowledge-base/${page.id}/edit`}
            className="text-xs text-text-secondary hover:text-text-primary"
          >
            Edit
          </Link>
          {(page.source === "crawled" || page.source === "url") && page.url && (
            <button
              type="button"
              onClick={handleResync}
              disabled={syncing}
              className="text-xs text-text-secondary hover:text-text-primary disabled:opacity-50"
            >
              {syncing ? "Syncing..." : "Re-sync"}
            </button>
          )}
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="text-xs text-error hover:text-error disabled:opacity-50"
          >
            {deleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
