"use client";

import { ModelSelector } from "@/components/settings/model-selector";

interface ModelOption {
  id: string;
  label: string;
  logo: string;
  available: boolean;
  providerKey: string;
  providerLabel: string;
}

export function ModelStep({
  currentModel,
  models,
  onNext,
  onBack,
}: {
  currentModel: string;
  models: ModelOption[];
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <div>
      <h2 className="mb-2 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Choose your model
      </h2>
      <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
        Select which model generates draft replies. If you don&apos;t have an
        API key configured, you&apos;ll be prompted to add one.
      </p>

      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-800/50">
        <ModelSelector currentModel={currentModel} models={models} />
      </div>

      <div className="mt-6 flex items-center justify-between">
        <button
          onClick={onBack}
          className="text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          &larr; Back
        </button>
        <button
          onClick={onNext}
          className="rounded-lg bg-zinc-900 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
