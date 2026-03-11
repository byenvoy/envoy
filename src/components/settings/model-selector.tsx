"use client";

import { useState } from "react";

interface ModelOption {
  id: string;
  label: string;
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

  function handleChange(modelId: string) {
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

  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-zinc-900 dark:text-zinc-50">
        AI Model
      </label>
      <select
        value={pendingModel ? pendingModel.id : selected}
        onChange={(e) => handleChange(e.target.value)}
        disabled={saving || savingKey}
        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
      >
        {models.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </select>

      {saving && (
        <p className="mt-1 text-xs text-zinc-500">Saving...</p>
      )}

      {pendingModel && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
          <p className="mb-3 text-sm text-amber-800 dark:text-amber-200">
            Enter your {pendingModel.providerLabel} API key to use{" "}
            {pendingModel.label}.
          </p>
          <div className="flex gap-2">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={`${pendingModel.providerLabel} API key...`}
              className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
            />
            <button
              type="button"
              onClick={handleSaveKeyAndSwitch}
              disabled={savingKey || !apiKey.trim()}
              className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {savingKey ? "Saving..." : "Save & Switch"}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400"
            >
              Cancel
            </button>
          </div>
          {error && (
            <p className="mt-2 text-xs text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
