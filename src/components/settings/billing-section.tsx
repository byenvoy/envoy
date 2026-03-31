"use client";

import { useState } from "react";

interface BillingProps {
  plan: string;
  status: string;
  trialEndsAt: string | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    trialing: "bg-ai-accent-light text-ai-accent",
    active: "bg-success-light text-primary",
    past_due: "bg-warning-light text-warning",
    canceled: "bg-error-light text-error",
    unpaid: "bg-error-light text-error",
  };

  const labels: Record<string, string> = {
    trialing: "Trial",
    active: "Active",
    past_due: "Past Due",
    canceled: "Canceled",
    unpaid: "Unpaid",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 font-display text-xs font-semibold ${
        styles[status] ?? "bg-surface-alt text-text-secondary"
      }`}
    >
      {labels[status] ?? status}
    </span>
  );
}

function trialDaysRemaining(trialEndsAt: string): number {
  const now = new Date();
  const end = new Date(trialEndsAt);
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}

export function BillingSection({
  plan,
  status,
  trialEndsAt,
  cancelAtPeriodEnd,
  currentPeriodEnd,
}: BillingProps) {
  const [loading, setLoading] = useState<"checkout" | "portal" | null>(null);

  async function handleCheckout() {
    setLoading("checkout");
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } finally {
      setLoading(null);
    }
  }

  async function handlePortal() {
    setLoading("portal");
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } finally {
      setLoading(null);
    }
  }

  const isActive = ["trialing", "active", "past_due"].includes(status);
  const isTrial = status === "trialing";
  const isPaid = status === "active" && plan === "pro";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <p className="font-display text-sm font-semibold text-text-primary">
          {plan === "trial" ? "Free Trial" : "Pro"}
        </p>
        <StatusBadge status={status} />
      </div>

      {isTrial && trialEndsAt && (
        <p className="font-body text-sm text-text-secondary">
          {trialDaysRemaining(trialEndsAt)} days remaining in your trial.
          Upgrade to keep using Envoyer after your trial ends.
        </p>
      )}

      {cancelAtPeriodEnd && currentPeriodEnd && (
        <p className="font-body text-sm text-text-secondary">
          Your subscription will end on{" "}
          {new Date(currentPeriodEnd).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
          .
        </p>
      )}

      {!isActive && (
        <p className="font-body text-sm text-text-secondary">
          Your subscription is no longer active. Upgrade to resume processing
          emails and generating drafts.
        </p>
      )}

      <div className="flex items-center gap-3">
        {(!isPaid || !isActive || cancelAtPeriodEnd) && (
          <button
            onClick={handleCheckout}
            disabled={loading !== null}
            className="rounded-lg bg-primary px-4 py-2 font-display text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading === "checkout"
              ? "Redirecting…"
              : isTrial
                ? "Upgrade to Pro — $15/mo"
                : "Subscribe — $15/mo"}
          </button>
        )}

        {isPaid && !cancelAtPeriodEnd && (
          <button
            onClick={handlePortal}
            disabled={loading !== null}
            className="rounded-lg border border-border px-4 py-2 font-display text-sm font-semibold text-text-primary transition-colors hover:bg-surface-alt disabled:opacity-50"
          >
            {loading === "portal" ? "Redirecting…" : "Manage Subscription"}
          </button>
        )}
      </div>
    </div>
  );
}
