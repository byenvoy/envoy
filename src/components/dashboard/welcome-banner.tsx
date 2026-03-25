"use client";

import { useState, useEffect } from "react";

interface EmbeddingStatus {
  totalPages: number;
  embeddedPages: number;
  totalChunks: number;
}

export function WelcomeBanner() {
  const [status, setStatus] = useState<EmbeddingStatus | null>(null);
  const [processing, setProcessing] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    async function poll() {
      try {
        const res = await fetch("/api/embeddings/status");
        if (!res.ok) return;
        const data: EmbeddingStatus = await res.json();
        setStatus(data);

        if (data.totalPages > 0 && data.embeddedPages < data.totalPages) {
          setProcessing(true);
        } else {
          setProcessing(false);
        }
      } catch {
        // Ignore polling errors
      }
    }

    poll();
    const timer = setInterval(poll, 5000);
    return () => clearInterval(timer);
  }, []);

  if (dismissed || !processing || !status) return null;

  const percent =
    status.totalPages > 0
      ? Math.round((status.embeddedPages / status.totalPages) * 100)
      : 0;

  return (
    <div className="mb-8 rounded-lg border border-border bg-surface-alt p-8 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success-light">
        <svg
          className="h-6 w-6 text-primary"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4.5 12.75l6 6 9-13.5"
          />
        </svg>
      </div>
      <h2 className="mb-2 font-display text-lg font-bold text-text-primary">
        You&apos;re all set!
      </h2>
      <p className="mb-4 text-sm text-text-secondary">
        Your knowledge base is being processed in the background. Once
        processing completes, Envoyer will start drafting replies to incoming
        emails.
      </p>
      <div className="mx-auto mb-4 max-w-xs">
        <div className="flex items-center justify-between font-mono text-xs text-text-secondary">
          <span>Processing pages...</span>
          <span>
            {status.embeddedPages}/{status.totalPages} ({percent}%)
          </span>
        </div>
        <div className="mt-1 h-1.5 w-full rounded-full bg-border">
          <div
            className="h-1.5 rounded-full bg-primary transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="rounded-lg bg-primary px-6 py-2 font-display text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
      >
        Okay!
      </button>
    </div>
  );
}
