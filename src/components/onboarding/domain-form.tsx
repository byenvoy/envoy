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
          className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Your website URL
        </label>
        <input
          id="domain"
          type="text"
          required
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-400 dark:focus:ring-zinc-400"
          placeholder="docs.example.com"
        />
      </div>
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {loading ? "Discovering pages..." : "Discover pages"}
      </button>
    </form>
  );
}
