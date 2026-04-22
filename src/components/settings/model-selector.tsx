"use client";

import { useState } from "react";
import Image from "next/image";

interface ModelOption {
  id: string;
  label: string;
  logo: string;
  darkLogo?: string;
  available: boolean;
  providerKey: string;
  providerLabel: string;
}

export function ModelSelector({
  currentModel,
  models,
  onAvailabilityChange,
}: {
  currentModel: string | null;
  models: ModelOption[];
  onAvailabilityChange?: (hasAvailableModel: boolean) => void;
}) {
  const [selected, setSelected] = useState(currentModel);
  const [saving, setSaving] = useState(false);
  const [pendingModel, setPendingModel] = useState<ModelOption | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [savingKey, setSavingKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableKeys, setAvailableKeys] = useState<Set<string>>(
    () => {
      const keys = new Set(models.filter((m) => m.available).map((m) => m.providerKey));
      return keys;
    }
  );

  async function switchModel(modelId: string) {
    setSaving(true);
    try {
      await fetch("/api/settings/model", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: modelId }),
      });
      setSelected(modelId);
    } finally {
      setSaving(false);
    }
  }

  function handleSelect(modelId: string) {
    if (saving || savingKey) return;
    const model = models.find((m) => m.id === modelId);
    if (!model) return;

    if (model.available || availableKeys.has(model.providerKey)) {
      setPendingModel(null);
      setApiKey("");
      setError(null);
      switchModel(modelId);
    } else {
      setPendingModel(model);
      setApiKey("");
      setError(null);
    }
  }

  async function handleSaveKeyAndSwitch() {
    if (!pendingModel || !apiKey.trim()) return;
    setSavingKey(true);
    setError(null);

    try {
      const keyRes = await fetch("/api/settings/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider_key: pendingModel.providerKey,
          api_key: apiKey,
        }),
      });

      if (!keyRes.ok) {
        const data = await keyRes.json();
        throw new Error(data.error ?? "Failed to save API key");
      }

      const newKeys = new Set([...availableKeys, pendingModel.providerKey]);
      setAvailableKeys(newKeys);

      await switchModel(pendingModel.id);
      setPendingModel(null);
      setApiKey("");
      onAvailabilityChange?.(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSavingKey(false);
    }
  }

  function handleCancel() {
    setPendingModel(null);
    setApiKey("");
    setError(null);
  }

  const activeId = pendingModel ? pendingModel.id : selected;

  return (
    <div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {models.map((m) => {
          const isActive = m.id === activeId;
          const isAvailable = m.available || availableKeys.has(m.providerKey);

          return (
            <button
              key={m.id}
              type="button"
              onClick={() => handleSelect(m.id)}
              disabled={saving || savingKey}
              className={`flex items-center gap-3 rounded-lg border px-3 py-3 text-left text-sm transition-colors ${
                isActive
                  ? "border-primary bg-surface ring-1 ring-primary"
                  : "border-border bg-surface-alt hover:border-primary hover:bg-surface"
              } ${(saving || savingKey) ? "cursor-not-allowed opacity-50" : ""}`}
            >
              <Image
                src={m.logo}
                alt=""
                width={20}
                height={20}
                className={`shrink-0 ${m.darkLogo ? "dark:hidden" : ""}`}
              />
              {m.darkLogo && (
                <Image
                  src={m.darkLogo}
                  alt=""
                  width={20}
                  height={20}
                  className="hidden shrink-0 dark:block"
                />
              )}
              <div className="min-w-0 flex-1">
                <span className={`block font-medium ${
                  isActive
                    ? "text-text-primary"
                    : "text-text-secondary"
                }`}>
                  {m.label}
                </span>
              </div>
              {isActive && (
                <div className="shrink-0">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div
        className={`mt-4 grid transition-all duration-200 ease-in-out ${
          pendingModel ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="rounded-lg border border-border bg-surface p-4">
            <p className="mb-3 font-display text-sm font-medium text-text-primary">
              {pendingModel?.providerLabel ?? ""} API key required
            </p>
            <p className="mb-3 text-xs text-text-secondary">
              Add your API key to use {pendingModel?.label ?? "this model"}. Your key is encrypted and stored securely.
            </p>
            <div className="flex gap-2">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={pendingModel ? `Paste your ${pendingModel.providerLabel} API key` : ""}
                className="flex-1 rounded-lg border border-border bg-surface-alt px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-primary focus:outline-none"
              />
              <button
                type="button"
                onClick={handleSaveKeyAndSwitch}
                disabled={savingKey || !apiKey.trim()}
                className="rounded-lg bg-primary px-4 py-2 font-display text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
              >
                {savingKey ? "Saving..." : "Save"}
              </button>
            </div>
            {error && (
              <p className="mt-2 text-xs text-error">
                {error}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
