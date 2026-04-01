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
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
        <p className="font-body text-sm text-text-primary">
          {isPaymentIssue
            ? "Your payment method needs to be updated. Please update it to continue using Envoyer."
            : "Your subscription has ended. Resubscribe to resume processing emails and generating drafts."}
        </p>
        <button
          onClick={handleAction}
          disabled={loading}
          className="shrink-0 rounded-lg bg-primary px-4 py-2 font-display text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading
            ? "Redirecting…"
            : isPaymentIssue
              ? "Update payment method"
              : "Resubscribe"}
        </button>
      </div>
    </div>
  );
}
