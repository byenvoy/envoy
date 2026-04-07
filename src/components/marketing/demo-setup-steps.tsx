"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";

const steps = [
  {
    id: "sources",
    title: "Add sources",
    description:
      "Point Envoyer at your internal docs, FAQ, or support pages. Changes sync automatically. It absorbs everything.",
  },
  {
    id: "inbox",
    title: "Connect your inbox and integrations",
    description:
      "Link your existing support inbox with a click, then connect Shopify or Stripe to pull in customer context.",
  },
  {
    id: "go",
    title: "Let Envoyer take it from there",
    description:
      "Every incoming email gets a draft grounded in your knowledge base. Review and send, or let Autopilot handle it.",
  },
];

/* ── Step visuals ── */

function SourcesVisual() {
  return (
    <>
      <div className="mb-6 flex gap-2.5">
        <span className="rounded-lg bg-primary px-4 py-2.5 font-display text-sm font-semibold text-white">
          Find pages by domain
        </span>
        <span className="rounded-lg border border-border px-4 py-2.5 font-display text-sm font-medium text-text-primary">
          Upload document
        </span>
      </div>
      <div className="space-y-2.5">
        {[
          { title: "Shipping & Returns", url: "/help/shipping-returns", synced: "Last synced 2 hours ago" },
          { title: "Getting Started", url: "/help/getting-started", synced: "Last synced 2 hours ago" },
          { title: "Billing FAQ", url: "/help/billing-faq", synced: "Last synced 5 hours ago" },
          { title: "Return Policy 2026", url: "return-policy-2026.pdf", synced: "Last synced 1 day ago" },
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
            <div className="flex items-center">
              <span className="font-mono text-[11px] text-text-secondary">
                {page.synced}
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
      {/* Email */}
      <div className="mb-5">
        <p className="mb-2.5 font-display text-[13px] font-semibold uppercase tracking-wider text-text-secondary">
          Email
        </p>
        <div className="flex items-center gap-3.5 rounded-lg border border-primary-light bg-success-light px-4 py-3.5">
          <Image src="/logos/google-icon.svg" alt="Google" width={28} height={28} className="h-7 w-7 flex-shrink-0 rounded object-contain" />
          <div className="flex-1">
            <p className="font-display text-sm font-semibold text-text-primary">Google</p>
            <p className="font-mono text-xs text-text-secondary">support@example.com</p>
          </div>
          <span className="rounded-sm bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            Connected
          </span>
        </div>
      </div>

      {/* Integrations */}
      <div>
        <p className="mb-2.5 font-display text-[13px] font-semibold uppercase tracking-wider text-text-secondary">
          Integrations
        </p>
        <div className="space-y-2.5">
          <div className="flex items-center gap-3.5 rounded-lg border border-primary-light bg-success-light px-4 py-3.5">
            <Image src="/logos/shopify.svg" alt="Shopify" width={28} height={28} className="h-7 w-7 flex-shrink-0 object-contain" />
            <div className="flex-1">
              <p className="font-display text-sm font-semibold text-text-primary">Shopify</p>
              <p className="font-mono text-xs text-text-secondary">example-store.myshopify.com</p>
            </div>
            <span className="rounded-sm bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              Connected
            </span>
          </div>
          <div className="flex items-center gap-3.5 rounded-lg border border-dashed border-border bg-surface px-4 py-3.5">
            <Image src="/logos/stripe.svg" alt="Stripe" width={28} height={28} className="h-7 w-7 flex-shrink-0 object-contain opacity-50" />
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
          { name: "Sarah M.", subject: "Where's my order? It said 3-5 days...", badge: "Draft ready", badgeClass: "bg-ai-accent-light text-[#8B6914]" },
          { name: "James R.", subject: "How do I change my subscription plan?", badge: "Auto-sent", badgeClass: "bg-success-light text-primary" },
          { name: "Mia F.", subject: "Return request for order #4821", badge: "Draft ready", badgeClass: "bg-ai-accent-light text-[#8B6914]" },
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
    </>
  );
}

const visuals: Record<string, () => React.ReactElement> = {
  sources: SourcesVisual,
  inbox: InboxVisual,
  go: GoVisual,
};

const stepIds = steps.map((s) => s.id);

export function DemoSetupSteps() {
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
    <div className="grid items-center gap-12 lg:grid-cols-2">
      {/* Left: visual panel */}
      <div className="order-2 rounded-xl border border-border bg-white p-7 lg:order-1">
        <Visual />
      </div>

      {/* Right: vertical tabs */}
      <div className="order-1 space-y-3 lg:order-2">
        {steps.map((step, i) => {
          const isActive = step.id === activeStep;
          return (
            <button
              key={step.id}
              onClick={() => handleClick(step.id)}
              className={`flex w-full items-start gap-4 rounded-xl border p-6 text-left transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                isActive
                  ? "border-border bg-surface-alt"
                  : "border-transparent hover:bg-surface-alt"
              }`}
            >
              <div className="flex-1">
                <h3 className={`font-display text-lg font-semibold leading-tight transition-colors ${isActive ? "text-text-primary" : "text-text-secondary"}`}>
                  <span className={`font-mono text-lg font-medium transition-colors ${isActive ? "text-primary" : "text-text-secondary/50"}`}>
                    {i + 1}.
                  </span>
                  {" "}
                  {step.title}
                </h3>
                <p className={`mt-2 text-sm leading-relaxed transition-colors ${isActive ? "text-text-secondary" : "text-text-secondary/30"}`}>
                  {step.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
