"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "./status-badge";
import { ThreadView, type ThreadMessage } from "./thread-view";
import type { Ticket, DraftReply } from "@/lib/types/database";
import type { ShopifyCustomerContext, ShopifyOrder } from "@/lib/types/shopify";

interface TicketDetailProps {
  ticket: Ticket;
  draft: DraftReply | null;
  threadMessages: ThreadMessage[];
}

export function TicketDetail({ ticket, draft, threadMessages }: TicketDetailProps) {
  const router = useRouter();
  const [editedContent, setEditedContent] = useState(
    draft?.edited_content ?? draft?.draft_content ?? ""
  );
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [customerContextOpen, setCustomerContextOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleAction(action: "approve" | "discard" | "regenerate") {
    setLoading(action);
    setError(null);

    try {
      const url = `/api/tickets/${ticket.id}/${action}`;
      const method = action === "approve" ? "POST" : action === "discard" ? "POST" : "POST";
      const body =
        action === "approve"
          ? JSON.stringify({ edited_content: editedContent })
          : undefined;

      const res = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Action failed");
      }

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
      const res = await fetch(`/api/tickets/${ticket.id}/edit`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ edited_content: editedContent }),
      });

      if (!res.ok) throw new Error("Failed to save");
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

  const isSentOrDiscarded = ticket.status === "sent" || ticket.status === "discarded";
  const chunks = draft?.chunks_used ?? [];
  const customerContext = draft?.customer_context as ShopifyCustomerContext | null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {ticket.subject || "(no subject)"}
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            From: {ticket.from_name ? `${ticket.from_name} <${ticket.from_email}>` : ticket.from_email}
          </p>
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            {new Date(ticket.created_at).toLocaleString()}
          </p>
        </div>
        <StatusBadge status={ticket.status} />
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Left: Customer email + thread */}
        <div className="space-y-4">
          {threadMessages.length > 0 && (
            <ThreadView messages={threadMessages} />
          )}

          <div>
            <h3 className="mb-2 text-sm font-medium text-zinc-900 dark:text-zinc-50">
              Customer Email
            </h3>
            <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                {ticket.body_text || "(empty body)"}
              </p>
            </div>
          </div>
        </div>

        {/* Right: Draft + actions */}
        <div className="space-y-4">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                Draft Reply
              </h3>
              <button
                onClick={handleCopy}
                className="rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-700"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            {draft ? (
              <textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                disabled={isSentOrDiscarded}
                rows={12}
                className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:focus:border-zinc-500"
              />
            ) : (
              <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {ticket.status === "new"
                    ? "Draft is being generated..."
                    : "No draft available"}
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          {!isSentOrDiscarded && draft && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleAction("approve")}
                disabled={loading !== null}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {loading === "approve" ? "Sending..." : "Approve & Send"}
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={loading !== null}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                {loading === "save" ? "Saving..." : "Save Edit"}
              </button>
              <button
                onClick={() => handleAction("regenerate")}
                disabled={loading !== null}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                {loading === "regenerate" ? "Regenerating..." : "Regenerate"}
              </button>
              <button
                onClick={() => handleAction("discard")}
                disabled={loading !== null}
                className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
              >
                {loading === "discard" ? "Discarding..." : "Discard"}
              </button>
            </div>
          )}

          {/* Sources */}
          {chunks.length > 0 && (
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-700">
              <button
                onClick={() => setSourcesOpen(!sourcesOpen)}
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-zinc-900 dark:text-zinc-50"
              >
                <span>Sources ({chunks.length})</span>
                <span className="text-zinc-400">{sourcesOpen ? "−" : "+"}</span>
              </button>
              {sourcesOpen && (
                <div className="border-t border-zinc-200 dark:border-zinc-700">
                  {chunks.map((chunk, i) => (
                    <div
                      key={chunk.id}
                      className={`px-4 py-3 ${i > 0 ? "border-t border-zinc-100 dark:border-zinc-800" : ""}`}
                    >
                      <div className="mb-1 flex items-center gap-2">
                        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                          Similarity: {(chunk.similarity * 100).toFixed(1)}%
                        </span>
                        {chunk.source_url && (
                          <a
                            href={chunk.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                          >
                            {chunk.source_url}
                          </a>
                        )}
                      </div>
                      <p className="line-clamp-4 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                        {chunk.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Customer Context (Shopify) */}
          {customerContext && (customerContext.customer || customerContext.recent_orders?.length > 0 || customerContext.active_returns?.length > 0) && (
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-700">
              <button
                onClick={() => setCustomerContextOpen(!customerContextOpen)}
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-zinc-900 dark:text-zinc-50"
              >
                <span>Customer Context</span>
                <span className="text-zinc-400">{customerContextOpen ? "−" : "+"}</span>
              </button>
              {customerContextOpen && (
                <div className="border-t border-zinc-200 px-4 py-3 dark:border-zinc-700">
                  {customerContext.customer && (
                    <div className="mb-3">
                      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Customer</p>
                      <p className="text-sm text-zinc-900 dark:text-zinc-50">
                        {[customerContext.customer.first_name, customerContext.customer.last_name].filter(Boolean).join(" ") || "Unknown"}
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {customerContext.customer.email}
                      </p>
                      <div className="mt-1 flex gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                        <span>Orders: {customerContext.customer.orders_count}</span>
                        <span>Total spent: ${customerContext.customer.total_spent}</span>
                        <span>Since: {new Date(customerContext.customer.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  )}

                  {customerContext.recent_orders?.length > 0 && (
                    <div className="mb-3">
                      <p className="mb-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">Recent Orders</p>
                      {customerContext.recent_orders.map((order: ShopifyOrder) => (
                        <div key={order.id} className="mb-2 rounded border border-zinc-100 px-3 py-2 dark:border-zinc-800">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-zinc-900 dark:text-zinc-50">{order.name}</span>
                            <span className="text-xs text-zinc-500 dark:text-zinc-400">
                              {new Date(order.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="mt-0.5 flex gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                            <span>{order.financial_status}</span>
                            <span>{order.fulfillment_status ?? "Unfulfilled"}</span>
                            <span>{order.total_price} {order.currency}</span>
                          </div>
                          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                            {order.line_items.map((li) => `${li.title}${li.variant_title ? ` (${li.variant_title})` : ""} x${li.quantity}`).join(", ")}
                          </p>
                          {order.fulfillments.map((f, fi) =>
                            f.tracking_number ? (
                              <p key={fi} className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                                Tracking: {f.tracking_url ? (
                                  <a href={f.tracking_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline dark:text-blue-400">
                                    {f.tracking_number}
                                  </a>
                                ) : f.tracking_number}
                                {f.estimated_delivery_at && ` — Est. delivery: ${new Date(f.estimated_delivery_at).toLocaleDateString()}`}
                              </p>
                            ) : null
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {customerContext.active_returns?.length > 0 && (
                    <div>
                      <p className="mb-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">Active Returns</p>
                      {customerContext.active_returns.map((ret) => (
                        <div key={ret.id} className="flex items-center justify-between rounded border border-zinc-100 px-3 py-2 dark:border-zinc-800">
                          <span className="text-xs text-zinc-900 dark:text-zinc-50">{ret.name}</span>
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">{ret.status}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
