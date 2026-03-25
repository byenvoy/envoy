"use client";

const TOTAL_STEPS = 3;

export function OnboardingProgress({ currentStep }: { currentStep: number }) {
  if (currentStep > TOTAL_STEPS) return null;

  return (
    <div className="mb-8 flex justify-center">
      <div className="flex items-center gap-2">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => {
          const stepNumber = i + 1;
          const isCompleted = stepNumber < currentStep;
          const isCurrent = stepNumber === currentStep;

          return (
            <div
              key={i}
              className={`h-1.5 w-8 rounded-full transition-colors ${
                isCompleted
                  ? "bg-primary"
                  : isCurrent
                    ? "bg-primary"
                    : "bg-border"
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}
