"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Conversation, Draft } from "@/lib/types/database";
import type { ShopifyCustomerContext } from "@/lib/types/shopify";

interface DraftPanelProps {
  conversation: Conversation;
  draft: Draft | null;
  shopifyCustomer: ShopifyCustomerContext | null;
  draftUsedCustomerData: boolean;
  onRefresh: () => void;
}

export function DraftPanel({ conversation, draft, shopifyCustomer, draftUsedCustomerData, onRefresh }: DraftPanelProps) {
  const router = useRouter();
  const [editedContent, setEditedContent] = useState(
    draft?.edited_content ?? draft?.draft_content ?? ""
  );
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleAction(action: "approve" | "discard" | "regenerate") {
    setLoading(action);
    setError(null);

    try {
      const url = `/api/conversations/${conversation.id}/${action}`;
      const body =
        action === "approve"
          ? JSON.stringify({ edited_content: editedContent })
          : undefined;

      const res = await fetch(url, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Action failed");
      }

      onRefresh();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setLoading(null);
    }
  }

  async function handleSaveEdit() {
    setLoading("save");
    setError(null);

    try {
      const res = await fetch(`/api/conversations/${conversation.id}/edit`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ edited_content: editedContent }),
      });

      if (!res.ok) throw new Error("Failed to save");
      onRefresh();
      router.refresh();
    } catch {
      setError("Failed to save edit");
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
      {/* Customer context card — always shows when Shopify data available */}
      {shopifyCustomer && (shopifyCustomer.customer || shopifyCustomer.recent_orders?.length > 0) && (
        <CustomerContextCard
          customerContext={shopifyCustomer}
          defaultExpanded={draftUsedCustomerData}
        />
      )}

      {/* Draft section — only when there's a pending draft */}
      {draft && isPending && (
        <div className="flex flex-1 flex-col gap-3 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-display text-sm font-semibold">
              <span className="inline-block h-2 w-2 rounded-full bg-ai-accent" />
              <span className="text-text-primary">AI Draft</span>
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

          <textarea
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
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

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={() => handleAction("approve")}
              disabled={loading !== null}
              className="flex-1 rounded-lg bg-primary px-4 py-2 font-display text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
            >
              {loading === "approve" ? "Sending..." : "Approve & Send"}
            </button>
            <button
              onClick={handleSaveEdit}
              disabled={loading !== null}
              className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface disabled:opacity-50"
            >
              {loading === "save" ? "..." : "Edit"}
            </button>
            <button
              onClick={() => handleAction("discard")}
              disabled={loading !== null}
              className="rounded-lg px-3 py-2 text-sm font-medium text-error transition-colors hover:bg-error-light disabled:opacity-50"
            >
              {loading === "discard" ? "..." : "Reject"}
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
