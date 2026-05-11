"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import { OnboardingProgress } from "./onboarding-progress";
import { EmailStep } from "./steps/email-step";
import { ModelStep } from "./steps/model-step";
import { ShopifyStep } from "./steps/shopify-step";
import { TeamStep } from "./steps/team-step";
import type { EmailConnection, Integration, TeamInvite } from "@/lib/types/database";

const STEP_NAMES = ["email", "model", "shopify", "team"] as const;
const TOTAL_STEPS = STEP_NAMES.length;

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
  teamInvites,
  isCloud,
}: {
  initialStep: number;
  currentModel: string | null;
  models: ModelOption[];
  emailConnections: EmailConnection[];
  hasGoogleClientId: boolean;
  hasMicrosoftClientId: boolean;
  shopifyIntegration: Integration | null;
  hasShopifyClientId: boolean;
  teamInvites: TeamInvite[];
  isCloud: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState(Math.min(initialStep, TOTAL_STEPS));

  useEffect(() => {
    posthog.capture("onboarding_started", { initial_step: initialStep });
  }, [initialStep]);

  async function persistStep(nextStep: number) {
    await fetch("/api/onboarding/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: nextStep }),
    });
  }

  async function finishOnboarding() {
    posthog.capture("onboarding_completed", { is_cloud: isCloud });
    await persistStep(TOTAL_STEPS + 1);

    if (isCloud) {
      try {
        const res = await fetch("/api/stripe/checkout-trial", { method: "POST" });
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
          return;
        }
      } catch (err) {
        console.error("Failed to create checkout session:", err);
      }
    }

    router.push("/knowledge-base");
    router.refresh();
  }

  function goNext() {
    posthog.capture("onboarding_step_completed", {
      step,
      step_name: STEP_NAMES[step - 1],
    });
    if (step >= TOTAL_STEPS) {
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
    posthog.capture("onboarding_step_skipped", {
      step,
      step_name: STEP_NAMES[step - 1],
    });
    if (step >= TOTAL_STEPS) {
      finishOnboarding();
      return;
    }
    const next = step + 1;
    setStep(next);
    persistStep(next);
  }

  return (
    <div className="flex flex-1 flex-col">
      <OnboardingProgress currentStep={step} />
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
      {step === 4 && (
        <TeamStep
          invites={teamInvites}
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
