"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
  const [editedContent, setEditedContent] = useState(
    draft?.edited_content ?? draft?.draft_content ?? ""
  );
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  async function handleApprove() {
    setLoading("approve");
    setError(null);

    try {
      const res = await fetch(`/api/conversations/${conversation.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ edited_content: editedContent }),
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

  const chunks = draft?.chunks_used ?? [];
  const isPending = draft?.status === "pending";

  return (
    <div className="flex h-full flex-col bg-surface-alt">
      {/* Customer context card */}
      {shopifyCustomer && (shopifyCustomer.customer || shopifyCustomer.recent_orders?.length > 0) && (
        <CustomerContextCard
          customerContext={shopifyCustomer}
          defaultExpanded={draftUsedCustomerData}
        />
      )}

      {/* Draft section */}
      {draft && isPending && (
        <div className="flex flex-1 flex-col gap-3 p-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-display text-sm font-semibold">
              <span className="inline-block h-2 w-2 rounded-full bg-ai-accent" />
              <span className="text-text-primary">AI Draft</span>
              {saveStatus === "saving" && (
                <span className="font-mono text-[10px] font-normal text-text-secondary">Saving...</span>
              )}
              {saveStatus === "saved" && (
                <span className="font-mono text-[10px] font-normal text-primary">Saved</span>
              )}
            </div>
            <button
              onClick={handleCopy}
              className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-text-secondary transition-colors hover:bg-surface"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>

          {error && (
            <p className="text-xs text-error">{error}</p>
          )}

          {/* Draft textarea */}
          <textarea
            value={editedContent}
            onChange={(e) => handleContentChange(e.target.value)}
            rows={10}
            className="flex-1 resize-none rounded-lg border border-l-[3px] border-l-ai-accent border-t-border border-r-border border-b-border bg-surface px-4 py-3 font-mono text-[13px] leading-relaxed text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />

          {/* Sources bar */}
          {(chunks.length > 0 || draftUsedCustomerData) && (
            <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2">
              <span className="font-display text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
                Sources
              </span>
              {chunks.map((chunk) => (
                <span
                  key={chunk.id}
                  className="inline-flex items-center gap-1 rounded-full bg-ai-accent-light px-2 py-0.5 text-[10px] font-medium text-ai-accent"
                >
                  {chunk.source_url
                    ? new URL(chunk.source_url).pathname.split("/").pop() || "KB"
                    : "KB"}
                  <span className="opacity-60">
                    {(chunk.similarity * 100).toFixed(0)}%
                  </span>
                </span>
              ))}
              {draftUsedCustomerData && (
                <span className="inline-flex items-center rounded-full bg-success-light px-2 py-0.5 text-[10px] font-medium text-primary">
                  Customer Data
                </span>
              )}
            </div>
          )}

          {/* Actions: Approve & Send + Regenerate */}
          <div className="flex gap-2">
            <button
              onClick={handleApprove}
              disabled={loading !== null}
              className="flex-1 rounded-lg bg-primary px-4 py-2 font-display text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
            >
              {loading === "approve" ? "Sending..." : "Approve & Send"}
            </button>
            <button
              onClick={handleRegenerate}
              disabled={loading !== null}
              className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface disabled:opacity-50"
            >
              {loading === "regenerate" ? "..." : "Regenerate"}
            </button>
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
