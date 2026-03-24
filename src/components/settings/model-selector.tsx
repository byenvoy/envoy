"use client";

import { useState } from "react";
import Image from "next/image";

interface ModelOption {
  id: string;
  label: string;
  logo: string;
  available: boolean;
  providerKey: string;
  providerLabel: string;
}

export function ModelSelector({
  currentModel,
  models,
}: {
  currentModel: string;
  models: ModelOption[];
}) {
  const [selected, setSelected] = useState(currentModel);
  const [saving, setSaving] = useState(false);
  const [pendingModel, setPendingModel] = useState<ModelOption | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [savingKey, setSavingKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableKeys, setAvailableKeys] = useState<Set<string>>(
    () => new Set(models.filter((m) => m.available).map((m) => m.providerKey))
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

      setAvailableKeys((prev) => new Set([...prev, pendingModel.providerKey]));

      await switchModel(pendingModel.id);
      setPendingModel(null);
      setApiKey("");
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
      <label className="mb-3 block text-sm font-display font-medium text-text-primary">
        AI Model
      </label>
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
                className="shrink-0"
              />
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

      {saving && (
        <p className="mt-2 text-xs text-text-secondary">Saving...</p>
      )}

      {pendingModel && (
        <div className="mt-3 rounded-lg border border-ai-accent bg-ai-accent-light p-4">
          <p className="mb-3 text-sm text-ai-accent">
            Enter your {pendingModel.providerLabel} API key to use{" "}
            {pendingModel.label}.
          </p>
          <div className="flex gap-2">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={`${pendingModel.providerLabel} API key...`}
              className="flex-1 rounded-lg border border-border bg-surface-alt px-3 py-1.5 text-sm text-text-primary placeholder:text-text-secondary focus:border-primary focus:outline-none"
            />
            <button
              type="button"
              onClick={handleSaveKeyAndSwitch}
              disabled={savingKey || !apiKey.trim()}
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
            >
              {savingKey ? "Saving..." : "Save & Switch"}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="text-xs text-text-secondary hover:text-text-primary"
            >
              Cancel
            </button>
          </div>
          {error && (
            <p className="mt-2 text-xs text-error">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
