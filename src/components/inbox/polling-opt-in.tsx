"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function PollingOptIn() {
  const router = useRouter();
  const [enabling, setEnabling] = useState(false);

  async function handleEnable() {
    setEnabling(true);
    try {
      const res = await fetch("/api/settings/polling", { method: "POST" });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setEnabling(false);
    }
  }

  return (
    <div className="flex h-full items-center justify-center">
      <div className="mx-auto max-w-lg text-center px-6">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-success-light">
          <svg className="h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="font-display text-2xl font-bold text-text-primary">
          Knowledge base ready
        </h2>
        <p className="mt-3 font-body text-base text-text-secondary leading-relaxed">
          Your knowledge base has content. When you enable polling, Envoy will start pulling in emails and writing draft replies using your sources.
        </p>
        <p className="mt-2 font-body text-sm text-text-secondary">
          You can always add more sources later — this just starts the email flow.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <a
            href="/knowledge-base"
            className="inline-flex items-center gap-2 rounded-lg border border-border px-5 py-2.5 font-display text-sm font-semibold text-text-secondary transition-colors hover:bg-surface-alt"
          >
            Review sources
          </a>
          <button
            onClick={handleEnable}
            disabled={enabling}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 font-display text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
          >
            {enabling ? "Enabling..." : "Start polling"}
            {!enabling && (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
