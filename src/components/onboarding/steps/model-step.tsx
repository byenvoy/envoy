"use client";

import { useState } from "react";
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
  currentModel: string | null;
  models: ModelOption[];
  onNext: () => void;
  onBack: () => void;
}) {
  const [hasModel, setHasModel] = useState(
    () => models.some((m) => m.available)
  );

  return (
    <div className="text-center">
      <h2 className="mb-2 font-display text-2xl font-bold tracking-tight text-text-primary">
        Choose your model
      </h2>
      <p className="mb-8 text-sm text-text-secondary">
        Select which AI model generates draft replies to your customers.
      </p>

      <div className="text-left">
        <ModelSelector
          currentModel={currentModel}
          models={models}
          onAvailabilityChange={setHasModel}
        />
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
          disabled={!hasModel}
          className="rounded-lg bg-primary px-8 py-2.5 font-display text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue
        </button>
      </div>
      {!hasModel && (
        <p className="mt-3 text-xs text-text-secondary">
          Select a model and add your API key to continue.
        </p>
      )}
    </div>
  );
}
