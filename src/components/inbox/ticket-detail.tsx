"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { marked, Renderer } from "marked";
import { useKeyboardShortcut, useIsMac } from "@/lib/hooks/use-keyboard-shortcut";
import { Tooltip } from "@/components/ui/tooltip";

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
  onSendStart?: () => void;
  onSendError?: () => void;
  /**
   * Autosave persisted a change the parent's detail cache doesn't know
   * about. The parent should drop its cached copy (without refetching —
   * a refetch mid-typing would swap the panel under the cursor) so the
   * next visit fetches fresh data.
   */
  onCacheInvalidate?: () => void;
}

export function DraftPanel({ conversation, draft, shopifyCustomer, draftUsedCustomerData, onRefresh, onSent, onSendStart, onSendError, onCacheInvalidate }: DraftPanelProps) {
  const router = useRouter();
  const isMac = useIsMac();
  const modKey = isMac ? "⌘" : "Ctrl";

  // Extract autopilot evaluation data if present (joined via Supabase relation)
  const autopilotEval = (draft as Record<string, unknown> | null)?.autopilot_evaluation as {
    gate3_passed: boolean | null;
    gate3_needs_human_reason: string | null;
    outcome: string | null;
  } | null;

  // Compose mode: no AI draft exists (escalated / skipped / failed) — the
  // same editor renders empty and the user writes the reply themselves.
  // The first autosave creates a pending manual draft server-side.
  const isCompose = !draft;

  const [editedContent, setEditedContent] = useState(
    draft?.edited_content ?? draft?.draft_content ?? ""
  );
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [isEditing, setIsEditing] = useState(isCompose);
  const [activeSources, setActiveSources] = useState<Set<string>>(new Set());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightSaveRef = useRef<Promise<void> | null>(null);
  const sendingRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hoveredMarkRef = useRef<HTMLElement | null>(null);

  const renderedHtml = useMemo(
    () => marked.parse(editedContent, { breaks: true, async: false, renderer: draftRenderer }) as string,
    [editedContent]
  );

  // Auto-save with debounce. In compose mode (no draft) the first save
  // creates a pending manual draft so typing survives navigation; clearing
  // all text deletes it again. The in-flight promise is tracked so Send
  // can await it — otherwise a save landing after approval would recreate
  // a stray pending draft with already-sent content.
  const autoSave = useCallback(
    async (content: string) => {
      if (sendingRef.current) return;
      if (draft) {
        if (draft.status !== "pending") return;
        // Don't save if content matches the original draft
        if (content === draft.draft_content && !draft.edited_content) return;
        if (content === draft.edited_content) return;
      }

      setSaveStatus("saving");
      const save = (async () => {
        try {
          const res = await fetch(`/api/conversations/${conversation.id}/edit`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ edited_content: content }),
          });
          if (res.ok) {
            setSaveStatus("saved");
            setTimeout(() => setSaveStatus("idle"), 2000);
            // The parent's cached detail no longer matches the server —
            // without this, navigating away and back shows pre-save state.
            onCacheInvalidate?.();
          }
        } catch {
          setSaveStatus("idle");
        }
      })();
      inFlightSaveRef.current = save;
      await save;
      if (inFlightSaveRef.current === save) inFlightSaveRef.current = null;
    },
    [conversation.id, draft, onCacheInvalidate]
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
    if (isCompose && !editedContent.trim()) return;
    setLoading(close ? "send-close" : "send");
    setError(null);
    sendingRef.current = true;
    // Serialize against autosave: cancel the pending debounce and wait for
    // any save already on the wire before approving.
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (inFlightSaveRef.current) await inFlightSaveRef.current.catch(() => {});
    onSendStart?.();

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
      onSendError?.();
      sendingRef.current = false;
    } finally {
      setLoading(null);
    }
  }

  async function handleRegenerate() {
    setLoading("regenerate");
    setError(null);
    // Exit edit mode so the textarea doesn't persist with about-to-be-replaced content
    setIsEditing(false);

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

  // Keyboard shortcuts — active while a pending draft or compose editor is
  // open. Send-class shortcuts work both inside and outside the editor;
  // bare keys (c, e) only fire outside since the editor must own typing.
  const isPending = draft?.status === "pending";
  const shortcutsEnabled = (isPending || isCompose) && loading === null;
  const canSend = !isCompose || editedContent.trim().length > 0;

  useKeyboardShortcut(
    { key: "Enter", mod: true },
    () => { void handleSend(false); },
    { enabled: shortcutsEnabled && canSend, allowInEditable: true }
  );
  useKeyboardShortcut(
    { key: "Enter", mod: true, shift: true },
    () => { void handleSend(true); },
    { enabled: shortcutsEnabled && canSend, allowInEditable: true }
  );
  useKeyboardShortcut(
    { key: "c", mod: true, shift: true },
    () => { void handleRegenerate(); },
    { enabled: shortcutsEnabled, allowInEditable: true }
  );
  useKeyboardShortcut(
    { key: "Escape" },
    () => {
      textareaRef.current?.blur();
      setIsEditing(false);
    },
    { enabled: shortcutsEnabled && isEditing, allowInEditable: true, preventDefault: false }
  );
  useKeyboardShortcut(
    { key: "c" },
    () => { void handleRegenerate(); },
    { enabled: shortcutsEnabled }
  );
  useKeyboardShortcut(
    { key: "e" },
    () => { setIsEditing(true); },
    { enabled: shortcutsEnabled }
  );

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
    <div className="flex h-full flex-col bg-surface-alt" onMouseOver={handleDraftMouseOver} onMouseLeave={clearActiveSources}>
      {/* Customer context card */}
      {shopifyCustomer && (shopifyCustomer.customer || shopifyCustomer.recent_orders?.length > 0) && (
        <CustomerContextCard
          customerContext={shopifyCustomer}
          defaultExpanded={draftUsedCustomerData}
        />
      )}

      {/* Draft / compose section — same editor whether the first byte came
          from the AI or the human */}
      {(isPending || isCompose) && (
        <div className="flex flex-1 flex-col gap-2 p-3 md:min-h-0 md:gap-3 md:p-4">
          {/* Compose mode: explain why there's no AI draft */}
          {isCompose && (
            <div className="rounded-md border border-border bg-surface px-3 py-2">
              <p className="font-display text-xs font-medium text-text-secondary">
                {COMPOSE_NOTICES[conversation.draft_state ?? ""] ?? COMPOSE_NOTICE_DEFAULT}
              </p>
            </div>
          )}
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
              <span className={`inline-block h-2 w-2 rounded-full ${isCompose ? "bg-primary" : "bg-ai-accent"}`} />
              <span className="text-text-primary">{isCompose ? "Compose" : "Draft"}</span>
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
                className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-text-primary transition-colors hover:border-text-secondary disabled:opacity-50 md:hidden"
              >
                {loading === "regenerate" ? "..." : "Regenerate"}
              </button>
              <button
                onClick={handleCopy}
                className="hidden rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-text-primary transition-colors hover:border-text-secondary md:block"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-xs text-error">{error}</p>
          )}

          {/* Draft preview / edit */}
          {loading === "regenerate" ? (
            <div
              role="status"
              aria-live="polite"
              aria-label="Generating new draft"
              className="flex max-h-[200px] flex-col gap-3 overflow-hidden rounded-lg border border-border bg-surface px-3 py-2.5 md:max-h-none md:flex-1 md:px-4 md:py-3"
            >
              <div className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-ai-accent" />
                <span className="font-mono text-[11px] text-text-secondary">Generating new draft...</span>
              </div>
              <div className="space-y-2">
                <div className="h-3 w-3/4 rounded shimmer-block" />
                <div className="h-3 w-full rounded shimmer-block" />
                <div className="h-3 w-5/6 rounded shimmer-block" />
                <div className="h-3 w-2/3 rounded shimmer-block" />
              </div>
            </div>
          ) : isEditing ? (
            <textarea
              ref={textareaRef}
              value={editedContent}
              onChange={(e) => handleContentChange(e.target.value)}
              onBlur={() => {
                // Keep the editor open while a compose is still empty — a
                // blank markdown preview is just a dead click target.
                if (!(isCompose && !editedContent.trim())) setIsEditing(false);
              }}
              placeholder="Write your reply..."
              rows={10}
              className="flex-1 resize-none rounded-lg border border-border bg-surface px-3 py-2.5 font-mono text-[13px] leading-relaxed text-text-primary placeholder-text-secondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary md:min-h-0 md:px-4 md:py-3"
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
              className="max-h-[200px] cursor-text overflow-y-auto break-words rounded-lg border border-border bg-surface px-3 py-2.5 font-mono text-[13px] leading-relaxed text-text-primary hover:border-primary/50 md:max-h-none md:min-h-0 md:flex-1 md:px-4 md:py-3 [&_a]:text-primary [&_a]:underline [&_p]:mb-2 [&_p:last-child]:mb-0 [&_.citation-mark]:bg-ai-accent-light"
              dangerouslySetInnerHTML={{ __html: annotatedHtml }}
            />
          )}

          {/* Sources bar — hidden during regenerate since the chips reflect the old draft */}
          {loading !== "regenerate" && (chunks.length > 0 || draftUsedCustomerData) && (
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
          <div className="sticky bottom-0 -mx-4 bg-surface-alt px-4 pb-[env(safe-area-inset-bottom,8px)] pt-3 md:static md:mx-0 md:bg-transparent md:px-0 md:pb-0 md:pt-0">
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <Tooltip label={`Send & Close (${modKey}⇧↵)`}>
                  <button
                    onClick={() => handleSend(true)}
                    disabled={loading !== null || !canSend}
                    aria-keyshortcuts={`${isMac ? "Meta" : "Control"}+Shift+Enter`}
                    className="w-full rounded-lg border border-primary px-3 py-2 font-display text-sm font-medium text-primary transition-colors hover:bg-success-light disabled:opacity-50"
                  >
                    {loading === "send-close" ? "..." : "Send & Close"}
                  </button>
                </Tooltip>
                <Tooltip label={`Send (${modKey}↵)`} className="flex-1">
                  <button
                    onClick={() => handleSend(false)}
                    disabled={loading !== null || !canSend}
                    aria-keyshortcuts={`${isMac ? "Meta" : "Control"}+Enter`}
                    className="w-full rounded-lg bg-primary px-4 py-2 font-display text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
                  >
                    {loading === "send" ? "Sending..." : "Send"}
                  </button>
                </Tooltip>
              </div>
              {/* Desktop: regenerate below send buttons */}
              <Tooltip label="Regenerate (C)" className="hidden md:block">
                <button
                  onClick={handleRegenerate}
                  disabled={loading !== null}
                  aria-keyshortcuts="c"
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-text-primary transition-colors hover:border-text-secondary disabled:opacity-50"
                >
                  {loading === "regenerate" ? "Regenerating..." : "Regenerate"}
                </button>
              </Tooltip>
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

/** Contextual explanation for why there's no AI draft to review. */
const COMPOSE_NOTICES: Record<string, string> = {
  escalated: "This conversation was escalated for human review. Write your reply below.",
  skipped: "This looks like marketing or automated mail, so Envoy didn't draft a reply.",
  failed: "Envoy couldn't draft a reply for this conversation. Write your reply below.",
};
const COMPOSE_NOTICE_DEFAULT = "No AI draft for this conversation. Write your reply below.";
