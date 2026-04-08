"use client";

import Link from "next/link";

export function LLMErrorBanner({ message }: { message: string }) {
  return (
    <div className="border-b border-red-200 bg-red-50 px-4 py-3 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <p className="font-body text-sm text-red-800">
          {message}{" "}
          <Link
            href="/settings"
            className="font-semibold text-red-900 underline hover:opacity-80"
          >
            Go to Settings
          </Link>
        </p>
      </div>
    </div>
  );
}
