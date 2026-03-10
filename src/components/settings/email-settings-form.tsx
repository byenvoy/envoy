"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { EmailAddress } from "@/lib/types/database";

export function EmailSettingsForm({
  emailAddress,
}: {
  emailAddress: EmailAddress | null;
}) {
  const router = useRouter();
  const [address, setAddress] = useState(emailAddress?.email_address ?? "");
  const [displayName, setDisplayName] = useState(
    emailAddress?.display_name ?? ""
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!address.trim()) return;

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch("/api/settings/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email_address: address.trim(),
          display_name: displayName.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      setSuccess(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="email_address"
          className="mb-1 block text-sm font-medium text-zinc-900 dark:text-zinc-50"
        >
          Inbound Email Address
        </label>
        <input
          id="email_address"
          type="email"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="support@company.inbound.app"
          className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500"
        />
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          The email address configured in Inbound.new that will receive customer emails.
        </p>
      </div>

      <div>
        <label
          htmlFor="display_name"
          className="mb-1 block text-sm font-medium text-zinc-900 dark:text-zinc-50"
        >
          Display Name
        </label>
        <input
          id="display_name"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Acme Support"
          className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500"
        />
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          The name that will appear in the &quot;From&quot; field of outgoing replies.
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      {success && (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">
          Settings saved successfully.
        </p>
      )}

      <button
        type="submit"
        disabled={loading || !address.trim()}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {loading ? "Saving..." : "Save"}
      </button>
    </form>
  );
}
