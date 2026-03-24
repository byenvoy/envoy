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
      <h2 className="mb-2 text-xl font-semibold font-display tracking-tight text-text-primary">
        Choose your model
      </h2>
      <p className="mb-6 text-sm text-text-secondary">
        Select which model generates draft replies. If you don&apos;t have an
        API key configured, you&apos;ll be prompted to add one.
      </p>

      <div className="rounded-lg border border-border bg-surface-alt p-6">
        <ModelSelector currentModel={currentModel} models={models} />
      </div>

      <div className="mt-6 flex items-center justify-between">
        <button
          onClick={onBack}
          className="text-sm text-text-secondary transition-colors hover:text-text-primary"
        >
          &larr; Back
        </button>
        <button
          onClick={onNext}
          className="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
