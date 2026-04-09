"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NewManualEntryPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title || !content) return;
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/knowledge-base/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to save");
      }

      fetch("/api/embeddings/generate", { method: "POST" });
      router.push("/knowledge-base");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6">
        <Link
          href="/knowledge-base"
          className="text-sm text-text-secondary transition-colors hover:text-text-primary"
        >
          &larr; Back to Knowledge Base
        </Link>
      </div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold font-display tracking-tight text-text-primary">
          Add Manual Entry
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Add a knowledge base entry manually.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium font-display text-text-primary">
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full rounded-lg border border-border bg-surface-alt px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-primary focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium font-display text-text-primary">
            Content
          </label>
          <p className="mb-1 text-xs text-text-secondary">Markdown supported</p>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            rows={12}
            className="w-full rounded-lg border border-border bg-surface-alt px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-primary focus:outline-none"
            placeholder="Write your knowledge base content here..."
          />
        </div>

        {error && (
          <p className="text-sm text-error">{error}</p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving || !title || !content}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium font-display text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Entry"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/knowledge-base")}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium font-display text-text-secondary transition-colors hover:bg-surface"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
