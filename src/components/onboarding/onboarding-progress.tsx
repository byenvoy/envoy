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
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Step {currentStep} of {STEPS.length}
          <span className="ml-2 text-zinc-900 dark:text-zinc-50">
            {STEPS[currentStep - 1]?.label}
          </span>
        </p>
        <div className="mt-2 h-1.5 w-full rounded-full bg-zinc-200 dark:bg-zinc-700">
          <div
            className="h-1.5 rounded-full bg-zinc-900 transition-all dark:bg-zinc-50"
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
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                      isCompleted
                        ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                        : isCurrent
                          ? "border-2 border-zinc-900 text-zinc-900 dark:border-zinc-50 dark:text-zinc-50"
                          : "border border-zinc-300 text-zinc-400 dark:border-zinc-600 dark:text-zinc-500"
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
                    className={`mt-1.5 whitespace-nowrap text-xs ${
                      isCurrent
                        ? "font-medium text-zinc-900 dark:text-zinc-50"
                        : isCompleted
                          ? "text-zinc-600 dark:text-zinc-400"
                          : "text-zinc-400 dark:text-zinc-500"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={`mx-2 mb-5 h-px flex-1 ${
                      stepNumber < currentStep
                        ? "bg-zinc-900 dark:bg-zinc-50"
                        : "bg-zinc-200 dark:bg-zinc-700"
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
