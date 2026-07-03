"use client";

import Link from "next/link";

interface EmailConnectionErrorBannerProps {
  // True when the underlying error looks auth-related (token revoked,
  // scope mismatch, etc.) — calls for explicit reconnect.
  needsReconnect: boolean;
}

export function EmailConnectionErrorBanner({ needsReconnect }: EmailConnectionErrorBannerProps) {
  const message = needsReconnect
    ? "Your email connection needs to be reconnected to keep receiving messages."
    : "Email sync hit an error and emails may not be coming in.";

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <p className="font-body text-sm text-amber-900">
          {message}{" "}
          <Link
            href="/settings"
            className="font-semibold text-amber-950 underline hover:opacity-80"
          >
            Go to Settings
          </Link>
        </p>
      </div>
    </div>
  );
}
