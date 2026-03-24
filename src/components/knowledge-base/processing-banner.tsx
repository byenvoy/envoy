"use client";

import { useState, useEffect } from "react";

interface EmbeddingStatus {
  totalPages: number;
  embeddedPages: number;
  totalChunks: number;
}

export function ProcessingBanner() {
  const [status, setStatus] = useState<EmbeddingStatus | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    async function poll() {
      try {
        const res = await fetch("/api/embeddings/status");
        if (!res.ok) return;
        const data: EmbeddingStatus = await res.json();
        setStatus(data);

        if (data.totalPages > 0 && data.embeddedPages < data.totalPages) {
          setVisible(true);
        } else {
          setVisible(false);
        }
      } catch {
        // Silently ignore polling errors
      }
    }

    poll();
    const timer = setInterval(poll, 5000);

    return () => clearInterval(timer);
  }, []);

  if (!visible || !status) return null;

  const percent =
    status.totalPages > 0
      ? Math.round((status.embeddedPages / status.totalPages) * 100)
      : 0;

  return (
    <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg
            className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
            Processing knowledge base...
          </p>
        </div>
        <p className="text-sm text-blue-600 dark:text-blue-400">
          {status.embeddedPages}/{status.totalPages} pages embedded
        </p>
      </div>
      <div className="mt-2 h-1.5 w-full rounded-full bg-blue-200 dark:bg-blue-800">
        <div
          className="h-1.5 rounded-full bg-blue-600 transition-all dark:bg-blue-400"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
