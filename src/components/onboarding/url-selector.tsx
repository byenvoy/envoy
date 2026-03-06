"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";

interface UrlSelectorProps {
  urls: { url: string; suggested: boolean }[];
  onBack: () => void;
}

export function UrlSelector({ urls, onBack }: UrlSelectorProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(urls.filter((u) => u.suggested).map((u) => u.url))
  );
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!filter) return urls;
    const lower = filter.toLowerCase();
    return urls.filter((u) => u.url.toLowerCase().includes(lower));
  }, [urls, filter]);

  const allFilteredSelected = filtered.every((u) => selected.has(u.url));

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filtered.forEach((u) => next.delete(u.url));
      } else {
        filtered.forEach((u) => next.add(u.url));
      }
      return next;
    });
  }

  function toggle(url: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(url)) {
        next.delete(url);
      } else {
        next.add(url);
      }
      return next;
    });
  }

  async function handleSubmit() {
    if (selected.size === 0) return;
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/crawl/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: Array.from(selected) }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to extract pages");
        return;
      }

      router.push("/knowledge-base");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          &larr; Back
        </button>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          {selected.size} of {urls.length} selected
        </span>
      </div>
      <input
        type="text"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-400 dark:focus:ring-zinc-400"
        placeholder="Filter URLs..."
      />
      <div className="flex items-center gap-2">
        <button
          onClick={toggleAll}
          className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          {allFilteredSelected ? "Deselect all" : "Select all"}
        </button>
      </div>
      <div className="max-h-96 space-y-1 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-2 dark:border-zinc-700 dark:bg-zinc-900">
        {filtered.map(({ url }) => (
          <label
            key={url}
            className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            <input
              type="checkbox"
              checked={selected.has(url)}
              onChange={() => toggle(url)}
              className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500 dark:border-zinc-600"
            />
            <span className="truncate text-zinc-700 dark:text-zinc-300">
              {url}
            </span>
          </label>
        ))}
      </div>
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      <button
        onClick={handleSubmit}
        disabled={loading || selected.size === 0}
        className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {loading
          ? "Extracting content..."
          : `Import ${selected.size} page${selected.size === 1 ? "" : "s"}`}
      </button>
    </div>
  );
}
