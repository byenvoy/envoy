"use client";

import { useState } from "react";

export function EmbedButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    pagesProcessed: number;
    chunksCreated: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/embeddings/generate", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to generate embeddings");
      }

      const data = await response.json();
      setResult(data);
    } catch {
      setError("Failed to generate embeddings. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-700"
      >
        {loading ? "Generating..." : "Generate Embeddings"}
      </button>
      {result && (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">
          Processed {result.pagesProcessed} page
          {result.pagesProcessed === 1 ? "" : "s"}, created{" "}
          {result.chunksCreated} chunk{result.chunksCreated === 1 ? "" : "s"}
        </p>
      )}
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
