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
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
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
        Connect your email account to receive and send emails directly through Envoyer.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        {hasGoogleClientId && (
          // eslint-disable-next-line @next/next/no-html-link-for-pages
          <a
            href="/api/email/oauth/google"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-alt px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
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
