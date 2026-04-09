"use client";

import { useState } from "react";

export function SubscriptionBanner({ status }: { status: string }) {
  const [loading, setLoading] = useState(false);

  const isPaymentIssue = status === "unpaid";

  async function handleAction() {
    setLoading(true);
    try {
      const endpoint = isPaymentIssue
        ? "/api/stripe/portal"
        : "/api/stripe/checkout";
      const res = await fetch(endpoint, { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border-b border-warning bg-warning-light px-4 py-3 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <p className="font-body text-sm text-text-primary">
          {isPaymentIssue ? (
            <>
              Your payment method needs to be updated.{" "}
              <button
                onClick={handleAction}
                disabled={loading}
                className="font-semibold text-primary underline hover:opacity-80 disabled:opacity-50"
              >
                {loading ? "Redirecting…" : "Update payment method"}
              </button>{" "}
              to continue using Envoy.
            </>
          ) : (
            <>
              Your subscription has ended.{" "}
              <button
                onClick={handleAction}
                disabled={loading}
                className="font-semibold text-primary underline hover:opacity-80 disabled:opacity-50"
              >
                {loading ? "Redirecting…" : "Resubscribe"}
              </button>{" "}
              to resume processing emails and generating drafts.
            </>
          )}
        </p>
      </div>
    </div>
  );
}
