import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import Link from "next/link";
import { DemoInbox } from "@/components/marketing/demo-inbox";
import { DemoDashboardStats } from "@/components/marketing/demo-dashboard-stats";
import { DemoSetupSteps } from "@/components/marketing/demo-setup-steps";
import { DemoSetupStepsHorizontal } from "@/components/marketing/demo-setup-steps-horizontal";
import { DemoCustomerContext } from "@/components/marketing/demo-customer-context";
import { IntegrationLogos } from "@/components/marketing/integration-logos";
import { DemoAutopilot } from "@/components/marketing/demo-autopilot";
import { ScrollReveal } from "@/components/marketing/scroll-reveal";
import { HeroBackground } from "@/components/marketing/hero-background";

export default async function LandingPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (session) {
    redirect("/dashboard");
  }

  return (
    <main className="relative overflow-hidden">
      <HeroBackground />

      {/* ── Hero ── */}
      <section className="relative pb-0 pt-20 sm:pt-28">
        <div className="mx-auto max-w-[800px] px-4 text-center sm:px-6">
          <ScrollReveal>
            <h1 className="font-display text-4xl font-bold leading-[1.08] tracking-tight text-primary-dark sm:text-5xl lg:text-6xl">
              Support that runs itself
            </h1>
          </ScrollReveal>
        </div>
      </section>

      {/* ── Inbox Demo ── */}
      <section className="relative pb-20 pt-16 sm:pt-20">
        <div className="mx-auto max-w-[1120px] px-4 sm:px-6">
          <ScrollReveal delay={0.3} direction="up">
            <div className="relative">
              {/* Glow */}
              <div
                className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[60%] w-[80%] -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{
                  background:
                    "radial-gradient(ellipse, rgba(149,213,178,0.15) 0%, transparent 70%)",
                }}
              />
              <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-[0_4px_6px_-1px_rgba(0,0,0,0.04),0_20px_50px_-12px_rgba(0,0,0,0.08)]">
                <DemoInbox />
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── Product basics ── */}
      <section className="py-20">
        <div className="mx-auto grid max-w-[1120px] grid-cols-1 gap-6 px-4 sm:grid-cols-3 sm:px-6">
          {[
            {
              title: "Works out of the box",
              desc: "No workflow changes, no agent building, no if-then rules to maintain.",
            },
            {
              title: "Understands your business",
              desc: "Trained on your knowledge base. Pulls from customer data. Writes in your voice.",
            },
            {
              title: "Never reckless",
              desc: "If confidence is low, routes it to you before sending.",
            },
          ].map((item, i) => (
            <ScrollReveal key={item.title} delay={i * 0.1}>
              <h3 className="font-display text-xl font-bold text-text-primary">
                {item.title}
              </h3>
              <p className="mt-2 font-body text-base leading-relaxed text-text-secondary">
                {item.desc}
              </p>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* ── Autopilot ── */}
      <section className="py-24">
        <div className="mx-auto max-w-[1120px] px-4 sm:px-6">
          <ScrollReveal>
            <h2 className="font-display text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
              Auto-reply to the easy ones
            </h2>
          </ScrollReveal>
          <div className="mt-14 grid items-center gap-14 lg:grid-cols-2">
            <ScrollReveal>
              <div className="space-y-8">
                <div>
                  <h3 className="font-display text-lg font-semibold text-text-primary">
                    Define topics
                  </h3>
                  <p className="mt-1 max-w-sm font-body text-base leading-relaxed text-text-secondary">
                    Define topics that can be automatically replied to.
                  </p>
                </div>
                <div>
                  <h3 className="font-display text-lg font-semibold text-text-primary">
                    Calibrate first
                  </h3>
                  <p className="mt-1 max-w-sm font-body text-base leading-relaxed text-text-secondary">
                    Topics calibrate before Envoyer takes it from there.
                  </p>
                </div>
                <div>
                  <h3 className="font-display text-lg font-semibold text-text-primary">
                    Routed when unsure
                  </h3>
                  <p className="mt-1 max-w-sm font-body text-base leading-relaxed text-text-secondary">
                    If Autopilot isn&apos;t too sure, it routes the draft to
                    you for approval. Your team is always in control.
                  </p>
                </div>
              </div>
            </ScrollReveal>
            <ScrollReveal delay={0.2}>
              <DemoAutopilot />
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ── Get Started ── */}
      <section className="py-24">
        <div className="mx-auto max-w-[1120px] px-4 sm:px-6">
          <ScrollReveal>
            <h2 className="font-display text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
              Up and running in minutes
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={0.2} className="mt-14">
            <DemoSetupSteps />
          </ScrollReveal>
        </div>
      </section>

      {/* ── Anti-bloat ── */}
      <section className="py-24">
        <div className="mx-auto max-w-[1120px] px-4 sm:px-6">
          <div className="max-w-2xl">
            <ScrollReveal>
              <h2 className="font-display text-3xl font-bold tracking-tight text-text-primary sm:text-[40px] sm:leading-[1.15]">
                Everything you need. Nothing you don&apos;t.
              </h2>
            </ScrollReveal>
            <ScrollReveal delay={0.1}>
              <ul className="mt-12 flex flex-col gap-5">
                {[
                  "Ticket queues to configure",
                  "Routing rules to maintain",
                  "Chatbot decision trees to map out",
                  "Workflows to debug when they break",
                  "Features you'll never use",
                ].map((item) => (
                  <li
                    key={item}
                    className="font-body text-lg text-text-secondary line-through decoration-border decoration-[1.5px]"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </ScrollReveal>
            <ScrollReveal delay={0.2}>
              <p className="mt-14 font-display text-lg font-semibold text-primary">
                We built one thing and made it work: Envoyer answers your
                customers. You run your business.
              </p>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section className="py-24">
        <div className="mx-auto max-w-[1120px] px-4 sm:px-6">
          <div className="max-w-2xl">
            <ScrollReveal>
              <h2 className="font-display text-3xl font-bold tracking-tight text-text-primary sm:text-[40px] sm:leading-[1.15]">
                Pricing that makes sense.
              </h2>
              <p className="mt-6 font-display text-xl font-semibold leading-snug text-text-primary sm:text-2xl">
                No per-seat fees. No per-resolution charges. No contracts. Just
                pay for what the AI costs to run.
              </p>
            </ScrollReveal>
            <ScrollReveal delay={0.1}>
              <p className="mt-8 max-w-xl font-body text-base leading-relaxed text-text-secondary">
                Most AI support tools mark up model costs 5-10x and hide it
                behind per-outcome pricing. Envoyer passes through model costs
                directly with zero markup. You pick the model. You see exactly
                what each response costs. You set your own spend limits.
              </p>
              <div className="mt-10 flex flex-wrap items-center gap-4">
                <Link
                  href="/pricing"
                  className="rounded-lg bg-primary px-7 py-3 font-display text-sm font-semibold text-white transition-colors hover:bg-primary-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  View pricing
                </Link>
                <span className="font-mono text-sm text-text-secondary">
                  14-day free trial.
                </span>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ── Integrations ── */}
      <section className="bg-surface-alt py-24">
        <div className="mx-auto max-w-[1120px] px-4 sm:px-6">
          <ScrollReveal>
            <h2 className="font-display text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
              Connects to your existing setup
            </h2>
            <p className="mt-3 max-w-md font-body text-base leading-relaxed text-text-secondary">
              Envoyer works with the tools you already use. No migration
              required.
            </p>
          </ScrollReveal>
          <ScrollReveal delay={0.2} className="mt-10 flex flex-wrap items-center gap-4">
            {[
              {
                name: "Gmail",
                icon: (
                  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none">
                    <path d="M22 6C22 4.9 21.1 4 20 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6Z" stroke="#EA4335" strokeWidth="1.5" fill="none" />
                    <path d="M22 6L12 13L2 6" stroke="#EA4335" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                ),
              },
              {
                name: "Outlook",
                icon: (
                  <svg className="h-6 w-6" viewBox="0 0 21 21" fill="none">
                    <rect fill="#0078D4" x="1" y="1" width="9" height="9" rx="1" />
                    <rect fill="#0078D4" x="11" y="1" width="9" height="9" rx="1" opacity="0.7" />
                    <rect fill="#0078D4" x="1" y="11" width="9" height="9" rx="1" opacity="0.5" />
                    <rect fill="#0078D4" x="11" y="11" width="9" height="9" rx="1" opacity="0.3" />
                  </svg>
                ),
              },
              {
                name: "Shopify",
                icon: (
                  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none">
                    <path d="M15.34 5.47C15.34 5.47 15.13 5.53 14.81 5.63C14.75 5.39 14.65 5.11 14.5 4.83C14.07 4.05 13.4 3.63 12.6 3.63C12.47 3.63 12.34 3.64 12.2 3.67C12.16 3.62 12.12 3.57 12.08 3.53C11.74 3.17 11.31 3 10.81 3.01C9.83 3.04 8.86 3.75 8.07 4.97C7.51 5.84 7.09 6.93 6.96 7.77L15.49 5.45C15.43 5.46 15.38 5.47 15.34 5.47Z" fill="#95BF47" />
                    <path d="M21 7.5L19.5 19L15.49 21.5V5.45L17.16 5C17.16 5 17.49 6.87 17.5 6.95C17.55 7.14 17.68 7.23 17.83 7.23C17.98 7.23 21 7.5 21 7.5Z" fill="#5E8E3E" />
                  </svg>
                ),
              },
              {
                name: "Stripe",
                icon: (
                  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none">
                    <rect x="2" y="4" width="20" height="16" rx="3" fill="#635BFF" />
                    <path d="M11.5 10.5C10.5 10.1 9.9 9.8 9.9 9.3C9.9 8.9 10.3 8.6 10.9 8.6C11.8 8.6 12.6 9 12.6 9L13.1 7.5C13.1 7.5 12.4 7 10.9 7C9.2 7 8 8 8 9.4C8 10.5 8.8 11.2 10 11.6C10.9 11.9 11.2 12.2 11.2 12.7C11.2 13.2 10.7 13.5 10.1 13.5C9.1 13.5 8.1 13 8.1 13L7.6 14.5C7.6 14.5 8.5 15.1 10.1 15.1C11.9 15.1 13.1 14.1 13.1 12.6C13.1 11.4 12.3 10.8 11.5 10.5Z" fill="white" />
                  </svg>
                ),
                comingSoon: true,
              },
            ].map((item) => (
              <div
                key={item.name}
                className="flex items-center gap-2.5 rounded-lg border border-border bg-white px-4 py-3"
              >
                {item.icon}
                <span className="font-display text-sm font-medium text-text-primary">
                  {item.name}
                </span>
                {"comingSoon" in item && (
                  <span className="font-mono text-[10px] text-text-secondary">
                    soon
                  </span>
                )}
              </div>
            ))}
          </ScrollReveal>
        </div>
      </section>

      {/* ── Feature: Customer Context ── */}
      <section className="py-24">
        <div className="mx-auto max-w-[1120px] px-4 sm:px-6">
          <div className="grid items-center gap-14 lg:grid-cols-2">
            <ScrollReveal>
              <h2 className="font-display text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
                Customer context, built in
              </h2>
              <p className="mt-4 max-w-md font-body text-base leading-relaxed text-text-secondary">
                Pull in customer data from Shopify and Stripe. Every draft is
                grounded in who the customer is and what they&apos;ve bought.
              </p>
              <div className="mt-8">
                <IntegrationLogos />
              </div>
            </ScrollReveal>
            <ScrollReveal delay={0.2}>
              <DemoCustomerContext />
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ── Feature: Full Visibility ── */}
      <section className="bg-surface-alt py-24">
        <div className="mx-auto max-w-[1120px] px-4 text-center sm:px-6">
          <ScrollReveal>
            <h2 className="font-display text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
              Full visibility
            </h2>
            <p className="mx-auto mt-3 max-w-md font-body text-base leading-relaxed text-text-secondary">
              Pick your model, track every dollar. Real-time metrics on what
              your AI is doing and what it costs.
            </p>
          </ScrollReveal>
          <ScrollReveal delay={0.2} className="mx-auto mt-10 max-w-3xl">
            <div className="overflow-hidden rounded-xl border border-border shadow-[0_2px_4px_rgba(0,0,0,0.03),0_8px_24px_rgba(0,0,0,0.05)]">
              <DemoDashboardStats />
            </div>
          </ScrollReveal>
          <ScrollReveal
            delay={0.3}
            className="mt-6 flex flex-wrap items-center justify-center gap-3"
          >
            {["Claude", "GPT-4o", "Gemini", "Mistral", "DeepSeek"].map(
              (model) => (
                <span
                  key={model}
                  className="rounded-md border border-border bg-surface px-4 py-2 font-mono text-xs font-medium text-text-secondary"
                >
                  {model}
                </span>
              )
            )}
          </ScrollReveal>
        </div>
      </section>

      {/* ── Your Terms ── */}
      <section className="py-24">
        <div className="mx-auto max-w-[1120px] px-4 sm:px-6">
          <ScrollReveal>
            <h2 className="text-center font-display text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
              Your terms
            </h2>
          </ScrollReveal>
          <div className="mt-12 grid grid-cols-1 gap-6 text-center sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                title: "No contracts",
                desc: "Month-to-month. Cancel anytime.",
              },
              {
                title: "Your tone",
                desc: "Customize voice, style, and guardrails.",
              },
              {
                title: "Open source",
                desc: "MIT licensed. Read every line.",
              },
              {
                title: "Self-hosted",
                desc: "Docker Compose, your infra, your data.",
              },
            ].map((term, i) => (
              <ScrollReveal key={term.title} delay={i * 0.1}>
                <h3 className="font-display text-base font-bold text-text-primary">
                  {term.title}
                </h3>
                <p className="mt-1 font-body text-sm text-text-secondary">
                  {term.desc}
                </p>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-24">
        <div className="mx-auto max-w-xl px-4 text-center sm:px-6">
          <ScrollReveal>
            <h2 className="font-display text-3xl font-bold tracking-tight text-text-primary sm:text-5xl">
              Ready to try it?
            </h2>
            <p className="mt-4 font-body text-base leading-relaxed text-text-secondary">
              Start with our hosted plan or deploy on your own infrastructure
              with Docker Compose. Same codebase, your choice.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/signup"
                className="rounded-md bg-primary px-8 py-3.5 font-body text-base font-semibold text-white transition-colors hover:bg-primary-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Start free trial
              </Link>
              <Link
                href="https://github.com/envoyer/envoyer"
                className="inline-flex items-center gap-2 rounded-md border border-border px-8 py-3.5 font-body text-base font-medium text-text-primary transition-colors hover:border-text-secondary hover:bg-surface-alt focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
                  />
                </svg>
                Self-host with Docker
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border py-8">
        <div className="mx-auto max-w-[1120px] px-4 sm:px-6">
          <div className="flex items-center justify-between">
            <span className="font-display text-base font-bold text-text-secondary">
              envoyer
            </span>
            <div className="flex items-center gap-6">
              <Link
                href="/pricing"
                className="font-body text-sm text-text-secondary transition-colors hover:text-text-primary"
              >
                Pricing
              </Link>
              <Link
                href="https://github.com/envoyer/envoyer"
                className="font-body text-sm text-text-secondary transition-colors hover:text-text-primary"
              >
                GitHub
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
