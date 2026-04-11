"use client";

import { useRouter } from "next/navigation";
import type { EmailConnection } from "@/lib/types/database";

export function EmailStep({
  connections,
  hasGoogleClientId,
  hasMicrosoftClientId,
  onNext,
  onBack,
}: {
  connections: EmailConnection[];
  hasGoogleClientId: boolean;
  hasMicrosoftClientId: boolean;
  onNext: () => void;
  onBack?: () => void;
}) {
  const router = useRouter();
  const activeConnection = connections.find((c) => c.status === "active");

  async function handleDisconnect(provider: string) {
    const res = await fetch("/api/email/oauth/disconnect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider }),
    });
    if (res.ok) router.refresh();
  }

  return (
    <div className="text-center">
      <h2 className="mb-2 font-display text-2xl font-bold tracking-tight text-text-primary">
        Connect your email
      </h2>
      <p className="mb-8 text-sm text-text-secondary">
        Envoy will receive customer emails and send approved replies through your connected account.
      </p>

      {activeConnection ? (
        <div className="mx-auto max-w-sm rounded-lg border border-primary bg-success-light p-5">
          <div className="flex items-center justify-center gap-2">
            {activeConnection.provider === "google" ? (
              <img src="/logos/google-icon.svg" alt="Google" className="h-4 w-4" />
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 21 21">
                <rect fill="#F25022" x="1" y="1" width="9" height="9" />
                <rect fill="#7FBA00" x="11" y="1" width="9" height="9" />
                <rect fill="#00A4EF" x="1" y="11" width="9" height="9" />
                <rect fill="#FFB900" x="11" y="11" width="9" height="9" />
              </svg>
            )}
            <span className="font-mono text-sm text-text-primary">
              {activeConnection.email_address}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-center gap-1.5">
            <span className="font-display text-xs font-medium text-primary">Connected</span>
            <svg className="h-3.5 w-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <button
            onClick={() => handleDisconnect(activeConnection.provider)}
            className="mt-3 text-[11px] text-text-secondary/60 transition-colors hover:text-error"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <div className="mx-auto flex max-w-sm flex-col gap-3">
          {hasGoogleClientId && (
            <a
              href="/api/email/oauth/google"
              className="inline-flex items-center justify-center gap-3 rounded-lg border border-border bg-surface-alt px-5 py-3 font-display text-sm font-medium text-text-primary transition-colors hover:border-text-secondary"
            >
              <img src="/logos/google-icon.svg" alt="Google" className="h-5 w-5" />
              Continue with Google
            </a>
          )}
          {hasMicrosoftClientId && (
            <a
              href="/api/email/oauth/microsoft"
              className="inline-flex items-center justify-center gap-3 rounded-lg border border-border bg-surface-alt px-5 py-3 font-display text-sm font-medium text-text-primary transition-colors hover:border-text-secondary"
            >
              <svg className="h-5 w-5" viewBox="0 0 21 21">
                <rect fill="#F25022" x="1" y="1" width="9" height="9" />
                <rect fill="#7FBA00" x="11" y="1" width="9" height="9" />
                <rect fill="#00A4EF" x="1" y="11" width="9" height="9" />
                <rect fill="#FFB900" x="11" y="11" width="9" height="9" />
              </svg>
              Continue with Microsoft
            </a>
          )}
          {!hasGoogleClientId && !hasMicrosoftClientId && (
            <p className="text-sm text-ai-accent">
              No email providers configured. Set up Google or Microsoft OAuth in your environment variables.
            </p>
          )}
        </div>
      )}

      <div className="mt-10 flex items-center justify-center gap-4">
        {onBack && (
          <button
            onClick={onBack}
            className="text-sm text-text-secondary transition-colors hover:text-text-primary"
          >
            &larr; Back
          </button>
        )}
        <button
          onClick={onNext}
          disabled={!activeConnection}
          className="rounded-lg bg-primary px-8 py-2.5 font-display text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
