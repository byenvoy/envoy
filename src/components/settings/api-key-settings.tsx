"use client";

import { useState } from "react";

interface ProviderKeyStatus {
  providerKey: string;
  label: string;
  hasOrgKey: boolean;
  lastFour: string | null;
}

export function ApiKeySettings({
  providers,
}: {
  providers: ProviderKeyStatus[];
}) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-text-secondary">
        Add your API key for the provider you want to use for draft generation.
        Keys are encrypted at rest.
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

  const isConfigured = status.hasOrgKey;

  return (
    <div className="rounded-lg border border-border px-4 py-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-text-primary">
            {provider.label}
          </p>
          <p className="text-xs text-text-secondary">
            {status.hasOrgKey ? (
              <span className="text-primary font-mono">
                Configured (...{status.lastFour})
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
              className="rounded px-2 py-1.5 text-[13px] font-medium text-text-secondary hover:text-text-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
            >
              {isConfigured ? "Update" : "Add Key"}
            </button>
          )}
          {status.hasOrgKey && !editing && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={removing}
              className="rounded px-2 py-1.5 text-[13px] font-medium text-error hover:text-error/80 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-error focus-visible:ring-offset-1"
            >
              {removing ? "Removing..." : "Remove"}
            </button>
          )}
        </div>
      </div>

      {editing && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={`Enter ${provider.label} API key...`}
            className="flex-1 rounded-lg border border-border bg-surface-alt px-3 py-1.5 text-sm text-text-primary placeholder:text-text-secondary focus:border-primary focus:outline-none"
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !key.trim()}
            className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setKey("");
            }}
            className="rounded px-2 py-1.5 text-[13px] font-medium text-text-secondary hover:text-text-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
