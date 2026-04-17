"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { marked, Renderer } from "marked";

const draftRenderer = new Renderer();
draftRenderer.link = ({ href, text }) =>
  `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`;
import { useRouter } from "next/navigation";
import type { Conversation, Draft } from "@/lib/types/database";
import type { ShopifyCustomerContext } from "@/lib/types/shopify";

interface DraftPanelProps {
  conversation: Conversation;
  draft: Draft | null;
  shopifyCustomer: ShopifyCustomerContext | null;
  draftUsedCustomerData: boolean;
  onRefresh: () => void;
  onSent: () => void;
}

export function DraftPanel({ conversation, draft, shopifyCustomer, draftUsedCustomerData, onRefresh, onSent }: DraftPanelProps) {
  const router = useRouter();

  // Extract autopilot evaluation data if present (joined via Supabase relation)
  const autopilotEval = (draft as Record<string, unknown> | null)?.autopilot_evaluation as {
    gate3_passed: boolean | null;
    gate3_needs_human_reason: string | null;
    outcome: string | null;
  } | null;

  const [editedContent, setEditedContent] = useState(
    draft?.edited_content ?? draft?.draft_content ?? ""
  );
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [isEditing, setIsEditing] = useState(false);
  const [activeSources, setActiveSources] = useState<Set<string>>(new Set());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hoveredMarkRef = useRef<HTMLElement | null>(null);

  const renderedHtml = useMemo(
    () => marked.parse(editedContent, { breaks: true, async: false, renderer: draftRenderer }) as string,
    [editedContent]
  );

  // Auto-save with debounce
  const autoSave = useCallback(
    async (content: string) => {
      if (!draft || draft.status !== "pending") return;
      // Don't save if content matches the original draft
      if (content === draft.draft_content && !draft.edited_content) return;
      if (content === draft.edited_content) return;

      setSaveStatus("saving");
      try {
        const res = await fetch(`/api/conversations/${conversation.id}/edit`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ edited_content: content }),
        });
        if (res.ok) {
          setSaveStatus("saved");
          setTimeout(() => setSaveStatus("idle"), 2000);
        }
      } catch {
        setSaveStatus("idle");
      }
    },
    [conversation.id, draft]
  );

  function handleContentChange(value: string) {
    setEditedContent(value);
    setSaveStatus("idle");

    // Debounce auto-save
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => autoSave(value), 800);
  }

  // Auto-focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  async function handleSend(close: boolean = false) {
    setLoading(close ? "send-close" : "send");
    setError(null);

    try {
      const res = await fetch(`/api/conversations/${conversation.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ edited_content: editedContent, close }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to send");
      }

      onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setLoading(null);
    }
  }

  async function handleRegenerate() {
    setLoading("regenerate");
    setError(null);

    try {
      const res = await fetch(`/api/conversations/${conversation.id}/regenerate`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to regenerate");
      }

      onRefresh();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to regenerate");
    } finally {
      setLoading(null);
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(editedContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDraftMouseOver(e: React.MouseEvent<HTMLDivElement>) {
    const mark = (e.target as HTMLElement).closest<HTMLElement>(".citation-mark");
    // Skip re-renders when still hovering the same mark
    if (mark === hoveredMarkRef.current) return;
    hoveredMarkRef.current = mark;
    if (mark) {
      const keysRaw = mark.getAttribute("data-source-keys");
      if (keysRaw) {
        try {
          setActiveSources(new Set(JSON.parse(keysRaw) as string[]));
          return;
        } catch { /* fall through */ }
      }
    }
    setActiveSources(new Set());
  }

  function clearActiveSources() {
    hoveredMarkRef.current = null;
    setActiveSources(new Set());
  }

  const chunks = draft?.chunks_used ?? [];
  const citationBlocks = draft?.citations_metadata ?? [];
  const isPending = draft?.status === "pending";

  // Build a deduplicated list of cited sources from all citation blocks.
  // A block may carry multiple citations (e.g. KB + Customer Data), so we
  // iterate the full citations array rather than just the first entry.
  const citedSources = useMemo(() => {
    const seen = new Map<string, { sourceUrl?: string; documentTitle?: string; index: number }>();
    for (const b of citationBlocks) {
      for (const c of b.citations ?? []) {
        const key = c.sourceUrl ?? String(c.documentIndex);
        if (!seen.has(key)) {
          seen.set(key, {
            sourceUrl: c.sourceUrl,
            documentTitle: c.documentTitle,
            index: seen.size + 1,
          });
        }
      }
    }
    return seen;
  }, [citationBlocks]);

  // Render citation-annotated HTML by processing blocks in order.
  // Each cited block is rendered through marked (inline) then wrapped in <mark> + superscript.
  // Falls back to the pre-rendered renderedHtml when edited or no citation blocks present.
  const annotatedHtml = useMemo(() => {
    if (citationBlocks.length === 0 || draft?.edited_content) return renderedHtml;
    const hasCitations = citationBlocks.some((b) => b.citations && b.citations.length > 0);
    if (!hasCitations) return renderedHtml;

    const renderInline = (text: string) => marked.parseInline(text) as string;

    const parts = citationBlocks.map((b) => {
      if (!b.citations || b.citations.length === 0) {
        // Uncited block — preserve paragraph and line breaks
        return b.text
          .split(/\n\n+/)
          .map(renderInline)
          .join("</p><p>")
          .replace(/\n/g, "<br>");
      }

      // Cited block — store the source keys as a data attribute so the
      // mouseover handler can highlight the matching pills in the sources bar.
      const inlineHtml = renderInline(b.text);
      const sourceKeys = b.citations
        .map((c) => c.sourceUrl ?? String(c.documentIndex))
        .filter((v, i, a) => a.indexOf(v) === i);
      const keysAttr = sourceKeys.length > 0
        ? ` data-source-keys="${JSON.stringify(sourceKeys).replace(/"/g, "&quot;")}"`
        : "";
      return `<mark class="citation-mark"${keysAttr}>${inlineHtml}</mark>`;
    });

    return `<p>${parts.join("")}</p>`;
  }, [citationBlocks, citedSources, renderedHtml, draft?.edited_content]);

  return (
    <div className="flex h-full flex-col bg-surface-alt" onMouseLeave={clearActiveSources}>
      {/* Customer context card */}
      {shopifyCustomer && (shopifyCustomer.customer || shopifyCustomer.recent_orders?.length > 0) && (
        <CustomerContextCard
          customerContext={shopifyCustomer}
          defaultExpanded={draftUsedCustomerData}
        />
      )}

      {/* Draft section */}
      {draft && isPending && (
        <div className="flex flex-1 flex-col gap-2 p-3 md:gap-3 md:p-4">
          {/* Gate 3 warning — draft flagged as needing human review */}
          {autopilotEval?.gate3_passed === false && (
            <div className="rounded-md border border-ai-accent/30 bg-ai-light px-3 py-2">
              <p className="text-xs font-display font-medium text-ai">
                Flagged for human review before sending
              </p>
              {autopilotEval.gate3_needs_human_reason && (
                <p className="mt-1 text-xs text-text-secondary">
                  {autopilotEval.gate3_needs_human_reason}
                </p>
              )}
            </div>
          )}
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-display text-sm font-semibold">
              <span className="inline-block h-2 w-2 rounded-full bg-ai-accent" />
              <span className="text-text-primary">Draft</span>
              {saveStatus === "saving" && (
                <span className="font-mono text-[10px] font-normal text-text-secondary">Saving...</span>
              )}
              {saveStatus === "saved" && (
                <span className="font-mono text-[10px] font-normal text-primary">Saved</span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {/* Mobile: regenerate in header row. Desktop: copy button */}
              <button
                onClick={handleRegenerate}
                disabled={loading !== null}
                className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-text-secondary transition-colors hover:bg-surface disabled:opacity-50 md:hidden"
              >
                {loading === "regenerate" ? "..." : "Regenerate"}
              </button>
              <button
                onClick={handleCopy}
                className="hidden rounded-md border border-border px-2.5 py-1 text-xs font-medium text-text-secondary transition-colors hover:bg-surface md:block"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-xs text-error">{error}</p>
          )}

          {/* Draft preview / edit */}
          {isEditing ? (
            <textarea
              ref={textareaRef}
              value={editedContent}
              onChange={(e) => handleContentChange(e.target.value)}
              onBlur={() => setIsEditing(false)}
              rows={10}
              className="flex-1 resize-none rounded-lg border border-border bg-surface px-3 py-2.5 font-mono text-[13px] leading-relaxed text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary md:px-4 md:py-3"
            />
          ) : (
            <div
              onClick={(e) => {
                if ((e.target as HTMLElement).closest("a")) return;
                const selection = window.getSelection();
                if (selection && selection.toString().length > 0) return;
                clearActiveSources();
                setIsEditing(true);
              }}
              onMouseOver={handleDraftMouseOver}
              onMouseLeave={clearActiveSources}
              className="max-h-[200px] cursor-text overflow-y-auto break-words rounded-lg border border-border bg-surface px-3 py-2.5 font-mono text-[13px] leading-relaxed text-text-primary hover:border-primary/50 md:max-h-none md:flex-1 md:px-4 md:py-3 [&_a]:text-primary [&_a]:underline [&_p]:mb-2 [&_p:last-child]:mb-0 [&_.citation-mark]:bg-ai-accent-light"
              dangerouslySetInnerHTML={{ __html: annotatedHtml }}
            />
          )}

          {/* Sources bar */}
          {(chunks.length > 0 || draftUsedCustomerData) && (
            <div className="flex items-center gap-1.5 overflow-x-auto rounded-lg border border-border bg-surface px-2.5 py-1.5 md:px-3 md:py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <span className="font-display text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
                Sources
              </span>

              {citedSources.size > 0 ? (
                // Anthropic citation mode: pills highlight when hovering cited text
                Array.from(citedSources.entries()).map(([key, source]) => {
                  const Tag = source.sourceUrl ? "a" : "span";
                  const label = source.sourceUrl
                    ? new URL(source.sourceUrl).pathname.split("/").pop() || "KB"
                    : source.documentTitle ?? "KB";
                  const isActive = activeSources.has(key);
                  return (
                    <Tag
                      key={source.index}
                      {...(source.sourceUrl ? { href: source.sourceUrl, target: "_blank", rel: "noopener noreferrer" } : {})}
                      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
                        isActive
                          ? "bg-ai-accent text-white"
                          : "bg-ai-accent-light text-ai-accent"
                      } ${source.sourceUrl ? "hover:opacity-80" : ""}`}
                    >
                      {label}
                    </Tag>
                  );
                })
              ) : (
                // Fallback: deduplicated URL chips (non-Anthropic models)
                chunks
                  .filter((chunk, i, arr) => {
                    const url = chunk.source_url ?? "";
                    return arr.findIndex((c) => (c.source_url ?? "") === url) === i;
                  })
                  .map((chunk) => {
                    const label = chunk.source_url
                      ? new URL(chunk.source_url).pathname.split("/").pop() || "KB"
                      : "KB";
                    const Tag = chunk.source_url ? "a" : "span";
                    return (
                      <Tag
                        key={chunk.id}
                        {...(chunk.source_url ? { href: chunk.source_url, target: "_blank", rel: "noopener noreferrer" } : {})}
                        className={`inline-flex shrink-0 items-center gap-1 rounded-full bg-ai-accent-light px-2 py-0.5 text-[10px] font-medium text-ai-accent ${chunk.source_url ? "hover:opacity-80 transition-opacity" : ""}`}
                      >
                        {label}
                      </Tag>
                    );
                  })
              )}

              {draftUsedCustomerData && citedSources.size === 0 && (
                <span className="inline-flex shrink-0 items-center rounded-full bg-success-light px-2 py-0.5 text-[10px] font-medium text-primary">
                  Customer Data
                </span>
              )}
            </div>
          )}

          {/* Actions — sticky on mobile so buttons stay above browser bar */}
          <div className="sticky bottom-0 -mx-4 border-t border-border bg-surface px-4 pb-[env(safe-area-inset-bottom,8px)] pt-3 md:static md:mx-0 md:border-t-0 md:bg-transparent md:px-0 md:pb-0 md:pt-0">
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <button
                  onClick={() => handleSend(true)}
                  disabled={loading !== null}
                  className="rounded-lg border border-primary px-3 py-2 font-display text-sm font-medium text-primary transition-colors hover:bg-success-light disabled:opacity-50"
                >
                  {loading === "send-close" ? "..." : "Send & Close"}
                </button>
                <button
                  onClick={() => handleSend(false)}
                  disabled={loading !== null}
                  className="flex-1 rounded-lg bg-primary px-4 py-2 font-display text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
                >
                  {loading === "send" ? "Sending..." : "Send"}
                </button>
              </div>
              {/* Desktop: regenerate below send buttons */}
              <button
                onClick={handleRegenerate}
                disabled={loading !== null}
                className="hidden rounded-lg border border-border px-3 py-2 text-xs font-medium text-text-secondary transition-colors hover:bg-surface disabled:opacity-50 md:block"
              >
                {loading === "regenerate" ? "Regenerating..." : "Regenerate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CustomerContextCard({
  customerContext,
  defaultExpanded,
}: {
  customerContext: ShopifyCustomerContext;
  defaultExpanded: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const customer = customerContext.customer;
  const orders = customerContext.recent_orders ?? [];

  return (
    <div className="border-b border-border bg-surface">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-surface-alt font-display text-[10px] font-bold text-text-secondary">
            {customer
              ? [customer.first_name, customer.last_name]
                  .filter(Boolean)
                  .map((n) => n![0])
                  .join("")
                  .toUpperCase() || "?"
              : "?"}
          </div>
          <div>
            <p className="font-display text-sm font-semibold text-text-primary">
              {customer
                ? [customer.first_name, customer.last_name].filter(Boolean).join(" ") || "Unknown"
                : "Customer"}
            </p>
            {!expanded && customer && (
              <p className="font-mono text-[11px] text-text-secondary">
                {customer.orders_count} {customer.orders_count === 1 ? "order" : "orders"} &middot; ${customer.total_spent}
              </p>
            )}
          </div>
        </div>
        <span className="text-xs text-text-secondary">{expanded ? "\u2212" : "+"}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-5">
          {customer && (
            <>
              <p className="font-mono text-[11px] text-text-secondary">{customer.email}</p>
              <div className="mt-2 flex gap-4">
                <div>
                  <p className="font-display text-base font-bold text-text-primary">
                    {customer.orders_count}
                  </p>
                  <p className="font-mono text-[10px] text-text-secondary">{customer.orders_count === 1 ? "order" : "orders"}</p>
                </div>
                <div>
                  <p className="font-display text-base font-bold text-text-primary">
                    ${customer.total_spent}
                  </p>
                  <p className="font-mono text-[10px] text-text-secondary">total spent</p>
                </div>
                <div>
                  <p className="font-display text-base font-bold text-text-primary">
                    {new Date(customer.created_at).getFullYear()}
                  </p>
                  <p className="font-mono text-[10px] text-text-secondary">since</p>
                </div>
              </div>
            </>
          )}

          {orders.length > 0 && (
            <div className="mt-3 rounded-lg border border-border bg-surface-alt p-2.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-text-primary">
                  {orders[0].name}
                </span>
                <span className="rounded-full bg-warning-light px-2 py-0.5 font-display text-[10px] font-medium text-ai-accent">
                  {orders[0].fulfillment_status ?? "Unfulfilled"}
                </span>
              </div>
              <div className="mt-1 font-mono text-[11px] leading-relaxed text-text-secondary">
                {orders[0].line_items
                  .map(
                    (li: { title: string; quantity: number }) =>
                      `${li.title} x${li.quantity}`
                  )
                  .join(", ")}
                <br />
                {orders[0].total_price} {orders[0].currency}
                {orders[0].fulfillments?.[0]?.tracking_number && (
                  <>
                    <br />
                    Tracking: {orders[0].fulfillments[0].tracking_number}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
