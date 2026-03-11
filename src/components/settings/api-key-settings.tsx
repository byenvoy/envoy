"use client";

import { useState } from "react";

interface ProviderKeyStatus {
  providerKey: string;
  label: string;
  hasOrgKey: boolean;
  hasEnvKey: boolean;
  lastFour: string | null;
}

export function ApiKeySettings({
  providers,
}: {
  providers: ProviderKeyStatus[];
}) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Add API keys for each provider you want to use. Keys are encrypted at
        rest. Server-level keys (set by the administrator) are used as fallback.
      </p>
      {providers.map((p) => (
        <ProviderKeyRow key={p.providerKey} provider={p} />
      ))}
    </div>
  );
}

function ProviderKeyRow({ provider }: { provider: ProviderKeyStatus }) {
  const [editing, setEditing] = useState(false);
  const [key, setKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [status, setStatus] = useState({
    hasOrgKey: provider.hasOrgKey,
    lastFour: provider.lastFour,
  });

  async function handleSave() {
    if (!key.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider_key: provider.providerKey, api_key: key }),
      });
      if (res.ok) {
        setStatus({ hasOrgKey: true, lastFour: key.slice(-4) });
        setKey("");
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    setRemoving(true);
    try {
      const res = await fetch("/api/settings/api-keys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider_key: provider.providerKey }),
      });
      if (res.ok) {
        setStatus({ hasOrgKey: false, lastFour: null });
      }
    } finally {
      setRemoving(false);
    }
  }

  const isConfigured = status.hasOrgKey || provider.hasEnvKey;

  return (
    <div className="rounded-lg border border-zinc-200 px-4 py-3 dark:border-zinc-700">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
            {provider.label}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {status.hasOrgKey ? (
              <span className="text-green-600 dark:text-green-400">
                Configured (...{status.lastFour})
              </span>
            ) : provider.hasEnvKey ? (
              <span className="text-green-600 dark:text-green-400">
                Using server key
              </span>
            ) : (
              <span>Not configured</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-xs text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
            >
              {isConfigured ? "Update" : "Add Key"}
            </button>
          )}
          {status.hasOrgKey && !editing && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={removing}
              className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50 dark:text-red-400"
            >
              {removing ? "Removing..." : "Remove"}
            </button>
          )}
        </div>
      </div>

      {editing && (
        <div className="mt-3 flex gap-2">
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={`Enter ${provider.label} API key...`}
            className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !key.trim()}
            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {saving ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setKey("");
            }}
            className="text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
