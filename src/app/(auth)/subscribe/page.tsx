"use client";

import { useState } from "react";

export default function SubscribePage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubscribe() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout-trial", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || "Something went wrong");
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <p className="font-display text-[15px] font-bold tracking-tight text-primary">
        envoyer
      </p>

      <h1 className="mt-6 font-display text-2xl font-bold tracking-tight text-text-primary">
        One last step
      </h1>
      <p className="mt-2 font-body text-sm leading-relaxed text-text-secondary">
        You&apos;re all set up. Add your payment details to start your
        14-day free trial — you won&apos;t be charged until the trial ends.
      </p>

      <div className="mt-6 rounded-lg border border-border bg-surface p-4">
        <div className="flex items-baseline justify-between">
          <p className="font-display text-sm font-semibold text-text-primary">
            Pro
          </p>
          <div className="flex items-baseline gap-1">
            <span className="font-display text-2xl font-bold tracking-tight text-text-primary">
              $15
            </span>
            <span className="font-body text-sm text-text-secondary">/month</span>
          </div>
        </div>
        <ul className="mt-4 space-y-2">
          <li className="flex items-center gap-2 font-body text-sm text-text-secondary">
            <span className="text-primary">&#10003;</span>
            Unlimited tickets, team members, and integrations
          </li>
          <li className="flex items-center gap-2 font-body text-sm text-text-secondary">
            <span className="text-primary">&#10003;</span>
            Fully managed — no infrastructure to maintain
          </li>
          <li className="flex items-center gap-2 font-body text-sm text-text-secondary">
            <span className="text-primary">&#10003;</span>
            Automatic updates — always on the latest version
          </li>
        </ul>
      </div>

      {error && (
        <p className="mt-4 font-body text-sm text-error">{error}</p>
      )}

      <button
        onClick={handleSubscribe}
        disabled={loading}
        className="mt-6 w-full rounded-lg bg-primary py-3 font-display text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {loading ? "Redirecting to checkout…" : "Continue to checkout"}
      </button>

      <p className="mt-4 text-center font-body text-xs leading-relaxed text-text-secondary">
        We&apos;ll email you 3 days and 1 day before billing starts.
      </p>
    </div>
  );
}
