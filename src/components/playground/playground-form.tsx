"use client";

import { useState } from "react";

interface MatchedChunk {
  id: string;
  content: string;
  similarity: number;
  source_url?: string;
}

export function PlaygroundForm() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [chunks, setChunks] = useState<MatchedChunk[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;

    setLoading(true);
    setError(null);
    setDraft(null);
    setChunks([]);

    try {
      const response = await fetch("/api/rag/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim() }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate draft");
      }

      const data = await response.json();
      setDraft(data.draft);
      setChunks(data.chunks ?? []);
    } catch {
      setError("Failed to generate draft. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!draft) return;
    await navigator.clipboard.writeText(draft);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Paste a customer email here..."
          rows={6}
          className="w-full rounded-lg border border-border bg-surface-alt px-4 py-3 text-sm text-text-primary placeholder:text-text-secondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          type="submit"
          disabled={loading || !message.trim()}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
        >
          {loading ? "Generating..." : "Generate Draft"}
        </button>
      </form>

      {error && (
        <p className="text-sm text-error">{error}</p>
      )}

      {draft && (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-surface-alt p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-medium font-display text-text-primary">
                Drafted Reply
              </h3>
              <button
                onClick={handleCopy}
                className="rounded-md border border-border px-3 py-1 text-xs font-medium text-text-secondary transition-colors hover:bg-surface"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-primary">
              {draft}
            </p>
          </div>

          {chunks.length > 0 && (
            <div className="rounded-lg border border-border">
              <button
                onClick={() => setSourcesOpen(!sourcesOpen)}
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium font-display text-text-primary"
              >
                <span>Sources ({chunks.length})</span>
                <span className="text-text-secondary">
                  {sourcesOpen ? "−" : "+"}
                </span>
              </button>
              {sourcesOpen && (
                <div className="border-t border-border">
                  {chunks.map((chunk, i) => (
                    <div
                      key={chunk.id}
                      className={`px-4 py-3 ${i > 0 ? "border-t border-border" : ""}`}
                    >
                      <div className="mb-1 flex items-center gap-2">
                        <span className="text-xs font-medium font-mono text-text-secondary">
                          Similarity: {(chunk.similarity * 100).toFixed(1)}%
                        </span>
                        {chunk.source_url && (
                          <a
                            href={chunk.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-info hover:underline"
                          >
                            {chunk.source_url}
                          </a>
                        )}
                      </div>
                      <p className="line-clamp-4 text-xs leading-relaxed text-text-secondary">
                        {chunk.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
