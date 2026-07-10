"use client";

import { useState } from "react";

const SUPPORT_PATTERNS =
  /\/(support|faq|help|docs|knowledge|article|guide|tutorial|delivery|returns|shipping|terms|policies|contact|about)/i;

function isSupportRelevant(url: string): boolean {
  try {
    const path = new URL(url).pathname;
    return SUPPORT_PATTERNS.test(path);
  } catch {
    return false;
  }
}

interface LocaleInfo {
  locales: string[];
  defaultLocale: string;
}

interface DomainFormProps {
  onUrlsDiscovered: (
    urls: { url: string; suggested: boolean }[],
    localeInfo: LocaleInfo | null,
  ) => void;
}

export function DomainForm({ onUrlsDiscovered }: DomainFormProps) {
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  async function pollDiscoverJob(jobId: string) {
    setStatusMessage("Scanning site for pages…");

    for (let i = 0; i < 45; i++) {
      await new Promise((r) => setTimeout(r, 2000));

      if (i === 5) setStatusMessage("Finding pages…");
      if (i === 15) setStatusMessage("Almost there…");

      const res = await fetch(`/api/crawl/jobs/${jobId}/status`);
      if (!res.ok) break;

      const data = await res.json();

      if (data.status === "completed") {
        const urls = (data.urls ?? []).map((url: string) => ({
          url,
          suggested: isSupportRelevant(url),
        }));
        if (urls.length === 0) {
          setError(
            data.blockReason
              ? "This site is protected by bot detection (Cloudflare), so we couldn't read it automatically. Reach out and we'll help you connect it."
              : "No pages found. Check the domain and try again.",
          );
          return;
        }
        onUrlsDiscovered(urls, null);
        return;
      }

      if (data.status === "failed") {
        setError(data.error || "Discovery failed. Please try again.");
        return;
      }
    }

    setError("Discovery timed out. Please try again.");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatusMessage(null);
    setLoading(true);

    try {
      const res = await fetch("/api/crawl/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to discover URLs");
        return;
      }

      if (data.status === "ok" && data.urls.length > 0) {
        onUrlsDiscovered(data.urls, data.localeInfo ?? null);
        return;
      }

      // Bot protection walled off the fetch tier — poll the browser worker job.
      if (data.status === "blocked" && data.jobId) {
        await pollDiscoverJob(data.jobId);
        return;
      }

      setError("No pages found. Check the domain and try again.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
      setStatusMessage(null);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="domain"
          className="mb-1 block text-sm font-medium font-display text-text-primary"
        >
          Your website URL
        </label>
        <input
          id="domain"
          type="text"
          required
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          className="w-full rounded-lg border border-border bg-surface-alt px-3 py-2.5 text-sm text-text-primary placeholder-text-secondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="docs.example.com"
        />
      </div>
      {error && (
        <p className="text-sm text-error">{error}</p>
      )}
      {statusMessage && !error && (
        <p className="text-sm text-text-secondary">{statusMessage}</p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="w-full cursor-pointer rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
      >
        {loading
          ? statusMessage
            ? "Scanning pages..."
            : "Discovering pages..."
          : "Discover pages"}
      </button>
    </form>
  );
}
