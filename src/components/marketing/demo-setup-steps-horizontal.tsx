"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const steps = [
  {
    id: "sources",
    title: "Add sources",
    description:
      "Point Envoy at your help docs, FAQ, or support pages. It crawls, chunks, and embeds them automatically.",
  },
  {
    id: "inbox",
    title: "Connect your inbox and integrations",
    description:
      "Link your existing support inbox with a click, then connect Shopify or Stripe to pull in customer context.",
  },
  {
    id: "go",
    title: "Let Envoy take it from there",
    description:
      "Every incoming email gets a draft grounded in your knowledge base. Review and send, or let Autopilot handle it.",
  },
];

/* ── Step visuals (same as vertical version) ── */

function SourcesVisual() {
  return (
    <>
      <div className="mb-6 flex gap-2.5">
        <input
          type="text"
          readOnly
          value="https://docs.example.com"
          className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3.5 py-2.5 font-mono text-[13px] text-text-primary"
        />
        <span className="rounded-lg bg-primary px-5 py-2.5 font-display text-sm font-semibold text-white">
          Crawl
        </span>
      </div>
      <div className="space-y-2.5">
        {[
          { title: "Shipping & Returns", url: "/help/shipping-returns", chunks: 14 },
          { title: "Getting Started", url: "/help/getting-started", chunks: 9 },
          { title: "Billing FAQ", url: "/help/billing-faq", chunks: 7 },
          { title: "Size Guide", url: "/help/size-guide", chunks: 5 },
        ].map((page) => (
          <div
            key={page.title}
            className="flex items-center justify-between rounded-lg border border-border bg-surface px-3.5 py-3"
          >
            <div>
              <p className="font-body text-sm font-medium text-text-primary">
                {page.title}
              </p>
              <p className="font-mono text-xs text-text-secondary">
                {page.url}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-text-secondary">
                {page.chunks} chunks
              </span>
              <span className="inline-flex items-center gap-1 rounded-sm bg-success-light px-2.5 py-0.5 text-xs font-medium text-primary">
                <svg className="h-3 w-3" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8.5L6.5 12L13 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Synced
              </span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function InboxVisual() {
  return (
    <>
      <div className="mb-5">
        <p className="mb-2.5 font-display text-[13px] font-semibold uppercase tracking-wider text-text-secondary">
          Email
        </p>
        <div className="flex items-center gap-3.5 rounded-lg border border-primary-light bg-success-light px-4 py-3.5">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center">
            <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none">
              <path d="M22 6C22 4.9 21.1 4 20 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6Z" stroke="#2D6A4F" strokeWidth="1.5" fill="none" />
              <path d="M22 6L12 13L2 6" stroke="#2D6A4F" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="font-display text-sm font-semibold text-text-primary">Google</p>
            <p className="font-mono text-xs text-text-secondary">support@example.com</p>
          </div>
          <span className="rounded-sm bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            Connected
          </span>
        </div>
      </div>
      <div>
        <p className="mb-2.5 font-display text-[13px] font-semibold uppercase tracking-wider text-text-secondary">
          Integrations
        </p>
        <div className="space-y-2.5">
          <div className="flex items-center gap-3.5 rounded-lg border border-primary-light bg-success-light px-4 py-3.5">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center">
              <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="#2D6A4F" strokeWidth="1.5" strokeLinejoin="round" />
                <path d="M2 17L12 22L22 17" stroke="#2D6A4F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M2 12L12 17L22 12" stroke="#2D6A4F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-display text-sm font-semibold text-text-primary">Shopify</p>
              <p className="font-mono text-xs text-text-secondary">example-store.myshopify.com</p>
            </div>
            <span className="rounded-sm bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              Connected
            </span>
          </div>
          <div className="flex items-center gap-3.5 rounded-lg border border-dashed border-border bg-surface px-4 py-3.5">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center">
              <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7V17L12 22L22 17V7L12 2Z" stroke="#6B6560" strokeWidth="1.5" strokeLinejoin="round" />
                <path d="M12 12V22" stroke="#6B6560" strokeWidth="1.5" />
                <path d="M12 12L22 7" stroke="#6B6560" strokeWidth="1.5" />
                <path d="M12 12L2 7" stroke="#6B6560" strokeWidth="1.5" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-display text-sm font-semibold text-text-secondary">Stripe</p>
              <p className="font-mono text-xs text-text-secondary">Coming soon</p>
            </div>
            <span className="rounded-sm bg-surface-alt px-2.5 py-0.5 text-xs font-medium text-text-secondary">
              Coming soon
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

function GoVisual() {
  return (
    <>
      <div className="mb-5 space-y-2">
        {[
          { name: "Sarah M.", subject: "Where's my order? It said 3-5 days...", badge: "Draft ready", badgeClass: "bg-ai-accent-light text-ai-accent" },
          { name: "James R.", subject: "How do I change my subscription plan?", badge: "Auto-sent", badgeClass: "bg-success-light text-primary" },
          { name: "Mia K.", subject: "Return request for order #4821", badge: "Draft ready", badgeClass: "bg-ai-accent-light text-ai-accent" },
          { name: "Alex T.", subject: "Do you ship to Canada?", badge: "Auto-sent", badgeClass: "bg-success-light text-primary" },
        ].map((item) => (
          <div
            key={item.name}
            className="flex items-center justify-between rounded-lg border border-border bg-surface px-3.5 py-3"
          >
            <div className="min-w-0 flex-1">
              <p className="font-display text-[13px] font-semibold text-text-primary">
                {item.name}
              </p>
              <p className="truncate text-[13px] text-text-secondary">
                {item.subject}
              </p>
            </div>
            <span className={`ml-3 flex-shrink-0 rounded-sm px-2.5 py-0.5 text-xs font-medium ${item.badgeClass}`}>
              {item.badge}
            </span>
          </div>
        ))}
      </div>
      <div className="flex overflow-hidden rounded-lg border border-border">
        {[
          { value: "94%", label: "Approval rate" },
          { value: "2m", label: "Avg response" },
          { value: "$0.02", label: "Per draft" },
        ].map((stat, i) => (
          <div
            key={stat.label}
            className={`flex-1 py-3.5 text-center ${i < 2 ? "border-r border-border" : ""}`}
          >
            <p className="font-display text-xl font-bold text-primary">
              {stat.value}
            </p>
            <p className="mt-0.5 text-xs text-text-secondary">{stat.label}</p>
          </div>
        ))}
      </div>
    </>
  );
}

const visuals: Record<string, () => React.ReactElement> = {
  sources: SourcesVisual,
  inbox: InboxVisual,
  go: GoVisual,
};

const stepIds = steps.map((s) => s.id);

export function DemoSetupStepsHorizontal() {
  const [activeStep, setActiveStep] = useState("sources");
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const Visual = visuals[activeStep];

  const advance = useCallback(() => {
    setActiveStep((prev) => {
      const idx = stepIds.indexOf(prev);
      return stepIds[(idx + 1) % stepIds.length];
    });
  }, []);

  useEffect(() => {
    if (paused) return;
    timerRef.current = setInterval(advance, 5000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [paused, advance]);

  function handleClick(id: string) {
    setActiveStep(id);
    setPaused(true);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setTimeout(() => setPaused(false), 15000);
  }

  return (
    <div>
      {/* Horizontal tabs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {steps.map((step, i) => {
          const isActive = step.id === activeStep;
          return (
            <button
              key={step.id}
              onClick={() => handleClick(step.id)}
              className={`rounded-xl border p-5 text-left transition-all ${
                isActive
                  ? "border-border bg-surface-alt"
                  : "border-transparent hover:bg-surface-alt"
              }`}
            >
              <h3 className="font-display text-lg font-semibold leading-tight text-text-primary">
                <span
                  className={`font-mono text-lg font-medium transition-colors ${
                    isActive ? "text-primary" : "text-text-secondary"
                  }`}
                >
                  {i + 1}.
                </span>
                {" "}
                {step.title}
              </h3>
              {/* Animate description */}
              <div
                className="grid transition-[grid-template-rows] duration-300 ease-in-out"
                style={{
                  gridTemplateRows: isActive ? "1fr" : "0fr",
                }}
              >
                <div className="overflow-hidden">
                  <p className="pt-2 text-sm leading-relaxed text-text-secondary">
                    {step.description}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Visual below */}
      <div className="mt-8 min-h-[420px] rounded-xl border border-border bg-surface p-7">
        <Visual />
      </div>
    </div>
  );
}
