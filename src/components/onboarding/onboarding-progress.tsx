"use client";

const STEPS = [
  { label: "Email" },
  { label: "Model" },
  { label: "Integrations" },
];

export function OnboardingProgress({ currentStep }: { currentStep: number }) {
  if (currentStep > STEPS.length) return null;

  return (
    <>
      {/* Mobile: compact text */}
      <div className="mb-6 sm:hidden">
        <p className="text-sm font-medium font-display text-text-secondary">
          Step {currentStep} of {STEPS.length}
          <span className="ml-2 text-text-primary">
            {STEPS[currentStep - 1]?.label}
          </span>
        </p>
        <div className="mt-2 h-1.5 w-full rounded-full bg-border">
          <div
            className="h-1.5 rounded-full bg-primary transition-all"
            style={{ width: `${(currentStep / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Desktop: horizontal step indicator */}
      <div className="mb-8 hidden sm:block">
        <div className="flex items-center justify-between">
          {STEPS.map((step, index) => {
            const stepNumber = index + 1;
            const isCompleted = stepNumber < currentStep;
            const isCurrent = stepNumber === currentStep;

            return (
              <div key={step.label} className="flex flex-1 items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium font-display transition-colors ${
                      isCompleted
                        ? "bg-primary text-white"
                        : isCurrent
                          ? "border-2 border-primary text-text-primary"
                          : "border border-border text-text-secondary"
                    }`}
                  >
                    {isCompleted ? (
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M4.5 12.75l6 6 9-13.5"
                        />
                      </svg>
                    ) : (
                      stepNumber
                    )}
                  </div>
                  <span
                    className={`mt-1.5 whitespace-nowrap text-xs font-display ${
                      isCurrent
                        ? "font-medium text-text-primary"
                        : isCompleted
                          ? "text-text-secondary"
                          : "text-text-secondary"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={`mx-2 mb-5 h-px flex-1 ${
                      stepNumber < currentStep
                        ? "bg-primary"
                        : "bg-border"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
