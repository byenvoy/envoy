type TopicMode = "off" | "shadow" | "auto";

const topics: {
  name: string;
  description: string;
  mode: TopicMode;
  dailySent: number;
}[] = [
  {
    name: "Shipping & Order Tracking",
    description:
      "Order status, shipping updates, delivery timelines, tracking numbers",
    mode: "shadow",
    dailySent: 0,
  },
  {
    name: "Returns & Refunds",
    description:
      "Return requests, refund status, return eligibility",
    mode: "auto",
    dailySent: 34,
  },
  {
    name: "Product Information",
    description:
      "Product details, sizing, materials, availability",
    mode: "auto",
    dailySent: 21,
  },
];

export function DemoAutopilot() {
  return (
    <div className="rounded-lg border border-border bg-surface-alt p-5">
      <h2 className="mb-3 font-display text-base font-medium text-text-primary">
        Topics
      </h2>

      <div className="space-y-2.5">
        {topics.map((topic) => (
          <div
            key={topic.name}
            className="rounded-lg border border-border bg-surface p-3.5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="font-display text-sm font-semibold text-text-primary">
                  {topic.name}
                </h3>
                <p className="mt-0.5 text-xs text-text-secondary">
                  {topic.description}
                </p>
              </div>
              <div
                className={`relative inline-flex h-7 w-14 shrink-0 items-center rounded-full ${
                  topic.mode !== "off" ? "bg-primary" : "bg-border"
                }`}
              >
                <span
                  className={`absolute inset-y-0 left-0 flex w-[34px] items-center justify-center text-[10px] font-semibold text-white transition-opacity ${
                    topic.mode !== "off" ? "opacity-100" : "opacity-0"
                  }`}
                >
                  On
                </span>
                <span
                  className={`absolute inset-y-0 right-0 flex w-[34px] items-center justify-center text-[10px] font-semibold text-text-secondary transition-opacity ${
                    topic.mode !== "off" ? "opacity-0" : "opacity-100"
                  }`}
                >
                  Off
                </span>
                <span
                  className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm ${
                    topic.mode !== "off"
                      ? "translate-x-8"
                      : "translate-x-0.5"
                  }`}
                />
              </div>
            </div>

            {topic.mode === "shadow" && (
              <div className="mt-2.5 rounded-md bg-ai-accent-light/40 px-3 py-2">
                <div className="flex items-center gap-2">
                  <p className="font-display text-xs font-semibold text-ai-accent">
                    Calibrating
                  </p>
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ai-accent opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-ai-accent" />
                  </span>
                </div>
                <p className="mt-1 text-xs text-text-secondary">
                  Getting ready for auto-replies. Drafts require your review
                  before sending while calibration completes. We&apos;ll notify
                  you when ready to go live.
                </p>
              </div>
            )}

            {topic.mode === "auto" && (
              <div className="mt-2.5 flex items-center gap-2">
                <p className="font-display text-xs font-semibold text-primary">
                  Active
                </p>
                <span className="inline-flex h-2 w-2 rounded-full bg-primary" />
                {topic.dailySent > 0 && (
                  <span className="font-mono text-[11px] text-text-secondary">
                    {topic.dailySent} sent today
                  </span>
                )}
              </div>
            )}
          </div>
        ))}

        <div className="rounded-lg border border-dashed border-border py-2.5 text-center text-sm font-medium text-text-secondary">
          + Create custom topic
        </div>
      </div>
    </div>
  );
}
