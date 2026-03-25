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
    <div className="text-center">
      <h2 className="mb-2 font-display text-2xl font-bold tracking-tight text-text-primary">
        Choose your model
      </h2>
      <p className="mb-8 text-sm text-text-secondary">
        Select which AI model generates draft replies to your customers.
      </p>

      <div className="text-left">
        <ModelSelector currentModel={currentModel} models={models} />
      </div>

      <div className="mt-10 flex items-center justify-center gap-4">
        <button
          onClick={onBack}
          className="text-sm text-text-secondary transition-colors hover:text-text-primary"
        >
          &larr; Back
        </button>
        <button
          onClick={onNext}
          className="rounded-lg bg-primary px-8 py-2.5 font-display text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
