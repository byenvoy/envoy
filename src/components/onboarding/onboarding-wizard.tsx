"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { OnboardingProgress } from "./onboarding-progress";
import { EmailStep } from "./steps/email-step";
import { ModelStep } from "./steps/model-step";
import { ShopifyStep } from "./steps/shopify-step";
import type { EmailConnection, Integration } from "@/lib/types/database";

interface ModelOption {
  id: string;
  label: string;
  logo: string;
  available: boolean;
  providerKey: string;
  providerLabel: string;
}

export function OnboardingWizard({
  initialStep,
  currentModel,
  models,
  emailConnections,
  hasGoogleClientId,
  hasMicrosoftClientId,
  shopifyIntegration,
  hasShopifyClientId,
}: {
  initialStep: number;
  currentModel: string;
  models: ModelOption[];
  emailConnections: EmailConnection[];
  hasGoogleClientId: boolean;
  hasMicrosoftClientId: boolean;
  shopifyIntegration: Integration | null;
  hasShopifyClientId: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState(Math.min(initialStep, 3));

  async function persistStep(nextStep: number) {
    await fetch("/api/onboarding/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: nextStep }),
    });
  }

  async function finishOnboarding() {
    await persistStep(4);
    router.push("/knowledge-base");
    router.refresh();
  }

  function goNext() {
    if (step >= 3) {
      finishOnboarding();
      return;
    }
    const next = step + 1;
    setStep(next);
    persistStep(next);
  }

  function goBack() {
    setStep((s) => Math.max(1, s - 1));
  }

  function skipStep() {
    goNext();
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="pt-8">
        <OnboardingProgress currentStep={step} />
      </div>
      <div className="mx-auto flex w-full max-w-xl flex-1 items-center">
        <div className="w-full">

      {step === 1 && (
        <EmailStep
          connections={emailConnections}
          hasGoogleClientId={hasGoogleClientId}
          hasMicrosoftClientId={hasMicrosoftClientId}
          onNext={goNext}
        />
      )}
      {step === 2 && (
        <ModelStep
          currentModel={currentModel}
          models={models}
          onNext={goNext}
          onBack={goBack}
        />
      )}
      {step === 3 && (
        <ShopifyStep
          integration={shopifyIntegration}
          hasShopifyClientId={hasShopifyClientId}
          onNext={goNext}
          onBack={goBack}
          onSkip={skipStep}
        />
      )}
        </div>
      </div>
    </div>
  );
}
