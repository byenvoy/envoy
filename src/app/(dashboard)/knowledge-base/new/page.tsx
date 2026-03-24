"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Add Manual Entry
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Add a knowledge base entry manually.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-900 dark:text-zinc-50">
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-900 dark:text-zinc-50">
            Content (Markdown)
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            rows={12}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
            placeholder="Write your knowledge base content here..."
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving || !title || !content}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {saving ? "Saving..." : "Save Entry"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/knowledge-base")}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
