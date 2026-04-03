"use client";

import { useState } from "react";
import Link from "next/link";
import type { KnowledgeBasePage } from "@/lib/types/database";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface PageCardProps {
  page: KnowledgeBasePage;
  syncing?: boolean;
}

export function PageCard({ page, syncing = false }: PageCardProps) {
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const preview = page.markdown_content
    ? page.markdown_content.slice(0, 150).replace(/[#*_\[\]]/g, "") + "..."
    : "No content";

  const lastChecked = new Date(
    page.last_crawled_at ?? page.updated_at
  ).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  async function handleResync() {
    await fetch(`/api/knowledge-base/${page.id}/resync`, { method: "POST" });
  }

  async function handleDelete() {
    setShowDeleteConfirm(false);
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
      <h3 className="mb-1 truncate text-base font-semibold font-display text-text-primary">
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
        <p className="text-[11px] font-mono text-text-secondary">
          Synced {lastChecked}
        </p>
        <div className="flex items-center gap-1">
        <Link
          href={`/knowledge-base/${page.id}/edit`}
          className="rounded px-1.5 py-1 text-xs text-text-secondary transition-colors hover:bg-surface hover:text-text-primary"
        >
          Edit
        </Link>
        {(page.source === "crawled" || page.source === "url") && page.url && (
          <button
            type="button"
            onClick={handleResync}
            disabled={syncing}
            className="cursor-pointer rounded px-1.5 py-1 text-xs text-text-secondary transition-colors hover:bg-surface hover:text-text-primary disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-text-secondary"
          >
            {syncing ? "Syncing..." : "Re-sync"}
          </button>
        )}
        <button
          type="button"
          onClick={() => setShowDeleteConfirm(true)}
          disabled={deleting}
          className="cursor-pointer rounded px-1.5 py-1 text-xs text-error transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {deleting ? "Deleting..." : "Delete"}
        </button>
        </div>
      </div>
      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete page"
        description="This page and its chunks will be permanently removed from the knowledge base."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}
