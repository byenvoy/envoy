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
        className="rounded-lg border border-border bg-surface-alt px-4 py-2 text-sm font-medium font-display text-text-primary transition-colors hover:bg-surface disabled:opacity-50"
      >
        {loading ? "Generating..." : "Generate Embeddings"}
      </button>
      {result && (
        <p className="text-sm text-primary">
          Processed {result.pagesProcessed} page
          {result.pagesProcessed === 1 ? "" : "s"}, created{" "}
          {result.chunksCreated} chunk{result.chunksCreated === 1 ? "" : "s"}
        </p>
      )}
      {error && (
        <p className="text-sm text-error">{error}</p>
      )}
    </div>
  );
}
