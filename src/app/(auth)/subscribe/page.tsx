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
    <div className="text-center">
      <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary">
        Start your free trial
      </h1>
      <p className="mt-3 font-body text-sm leading-relaxed text-text-secondary">
        Enter your payment details to begin your 14-day free trial.
        <br />
        You won&apos;t be charged until the trial ends, and we&apos;ll
        <br />
        email you 3 days and 1 day before billing starts.
      </p>
      <p className="mt-1 font-body text-xs text-text-secondary">
        Pro plan — $15/mo after trial. Cancel anytime.
      </p>

      {error && (
        <p className="mt-4 font-body text-sm text-error">{error}</p>
      )}

      <button
        onClick={handleSubscribe}
        disabled={loading}
        className="mt-6 rounded-lg bg-primary px-6 py-3 font-display text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {loading ? "Redirecting to checkout…" : "Continue to checkout"}
      </button>
    </div>
  );
}
