"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function EditPageForm({
  pageId,
  initialTitle,
  initialContent,
}: {
  pageId: string;
  initialTitle: string;
  initialContent: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/knowledge-base/${pageId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to save");
      }

      router.push("/knowledge-base");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium font-display text-text-primary">
          Title
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="w-full rounded-lg border border-border bg-surface-alt px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium font-display text-text-primary">
          Content (Markdown)
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
          rows={12}
          className="w-full rounded-lg border border-border bg-surface-alt px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none"
        />
      </div>

      {error && (
        <p className="text-sm text-error">{error}</p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium font-display text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Changes"}
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
  );
}
