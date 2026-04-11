"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { EmailConnection } from "@/lib/types/database";

export function EmailConnectionPicker({
  connections,
  hasGoogleClientId,
  hasMicrosoftClientId,
}: {
  connections: EmailConnection[];
  hasGoogleClientId: boolean;
  hasMicrosoftClientId: boolean;
}) {
  const router = useRouter();
  const activeConnection = connections.find((c) => c.status !== "revoked");
  const [disconnecting, setDisconnecting] = useState(false);

  async function handleDisconnect(provider: string) {
    setDisconnecting(true);
    try {
      const res = await fetch("/api/email/oauth/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      if (res.ok) router.refresh();
    } finally {
      setDisconnecting(false);
    }
  }

  if (!hasGoogleClientId && !hasMicrosoftClientId) {
    return (
      <p className="text-sm text-text-secondary">
        No email providers configured. Set <code className="rounded bg-surface px-1 py-0.5 text-xs font-mono">GOOGLE_CLIENT_ID</code> or{" "}
        <code className="rounded bg-surface px-1 py-0.5 text-xs font-mono">MICROSOFT_CLIENT_ID</code> environment variables to enable email connections.
      </p>
    );
  }

  if (activeConnection) {
    return (
      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {activeConnection.provider === "google" ? (
                <img src="/logos/google-icon.svg" alt="Google" className="h-4 w-4 shrink-0" />
              ) : (
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 21 21">
                  <rect fill="#F25022" x="1" y="1" width="9" height="9" />
                  <rect fill="#7FBA00" x="11" y="1" width="9" height="9" />
                  <rect fill="#00A4EF" x="1" y="11" width="9" height="9" />
                  <rect fill="#FFB900" x="11" y="11" width="9" height="9" />
                </svg>
              )}
              <p className="truncate text-sm font-medium text-text-primary">
                {activeConnection.email_address}
              </p>
            </div>
            <p className="mt-1 text-xs text-text-secondary">
              Status:{" "}
              <span
                className={
                  activeConnection.status === "active"
                    ? "text-primary"
                    : "text-error"
                }
              >
                {activeConnection.status}
              </span>
              {activeConnection.last_polled_at && (
                <> · Last polled: {new Date(activeConnection.last_polled_at).toLocaleString()}</>
              )}
            </p>
            {activeConnection.error_message && (
              <p className="mt-1 text-xs text-error">
                {activeConnection.error_message}
              </p>
            )}
          </div>
          <button
            onClick={() => handleDisconnect(activeConnection.provider)}
            disabled={disconnecting}
            className="shrink-0 self-start rounded px-2 py-1.5 text-[13px] font-medium text-error transition-colors hover:text-error/80 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-error focus-visible:ring-offset-1"
          >
            {disconnecting ? "Disconnecting..." : "Disconnect"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-text-secondary">
        Connect your email account to receive and send emails directly through Envoy.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        {hasGoogleClientId && (
          // eslint-disable-next-line @next/next/no-html-link-for-pages
          <a
            href="/api/email/oauth/google"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-alt px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface"
          >
            <img src="/logos/google-icon.svg" alt="Google" className="h-4 w-4" />
            Connect with Google
          </a>
        )}
        {hasMicrosoftClientId && (
          // eslint-disable-next-line @next/next/no-html-link-for-pages
          <a
            href="/api/email/oauth/microsoft"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-alt px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface"
          >
            <svg className="h-4 w-4" viewBox="0 0 21 21">
              <rect fill="#F25022" x="1" y="1" width="9" height="9" />
              <rect fill="#7FBA00" x="11" y="1" width="9" height="9" />
              <rect fill="#00A4EF" x="1" y="11" width="9" height="9" />
              <rect fill="#FFB900" x="11" y="11" width="9" height="9" />
            </svg>
            Connect with Microsoft
          </a>
        )}
      </div>
    </div>
  );
}
