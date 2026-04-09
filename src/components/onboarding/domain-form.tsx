"use client";

import { useState } from "react";

interface DomainFormProps {
  onUrlsDiscovered: (urls: { url: string; suggested: boolean }[]) => void;
}

export function DomainForm({ onUrlsDiscovered }: DomainFormProps) {
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
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

      if (data.urls.length === 0) {
        setError("No pages found. Check the domain and try again.");
        return;
      }

      onUrlsDiscovered(data.urls);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
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
      <button
        type="submit"
        disabled={loading}
        className="w-full cursor-pointer rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Discovering pages..." : "Discover pages"}
      </button>
    </form>
  );
}
