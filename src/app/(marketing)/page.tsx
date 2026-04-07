import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import Link from "next/link";
import Image from "next/image";
import { DemoInbox } from "@/components/marketing/demo-inbox";
import { DemoSetupSteps } from "@/components/marketing/demo-setup-steps";
import { DemoSetupStepsHorizontal } from "@/components/marketing/demo-setup-steps-horizontal";
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
          <ScrollReveal delay={0.1}>
            <p className="mx-auto mt-5 max-w-lg font-body text-lg leading-relaxed text-text-secondary">
              AI that reads your docs, drafts replies, and lets your team send
              them. Human touch, AI speed.
            </p>
          </ScrollReveal>
          <ScrollReveal delay={0.2} className="mt-8">
            <Link
              href="/signup"
              className="inline-flex rounded-lg bg-primary px-7 py-3 font-display text-sm font-semibold text-white transition-colors hover:bg-primary-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Start free trial
            </Link>
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
          <div className="grid items-center gap-14 lg:grid-cols-2">
            <ScrollReveal>
              <h2 className="font-display text-3xl font-bold tracking-tight text-text-primary sm:text-[40px] sm:leading-[1.15]">
                Pricing that makes sense.
              </h2>
              <p className="mt-6 font-display text-xl font-semibold leading-snug text-text-primary sm:text-2xl">
                No per-seat fees. No per-resolution charges. No upfront contracts.
              </p>
              <p className="mt-8 max-w-md font-body text-base leading-relaxed text-text-secondary">
                Most AI support tools mark up model costs 5-10x and hide it
                behind per-outcome pricing. Envoyer passes through model costs
                directly with zero markup. Pick your own model based on your needs. You see exactly
                what each response costs. Set your own spend limits.
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
            <ScrollReveal delay={0.2}>
              <div className="relative h-80">
                {[
                  { name: "Claude", src: "/logos/anthropic.svg", top: "8%", left: "12%" },
                  { name: "GPT-4o", src: "/logos/openai.svg", top: "2%", left: "58%" },
                  { name: "Gemini", src: "/logos/gemini-icon.png", top: "38%", left: "35%" },
                  { name: "Mistral", src: "/logos/mistral.svg", top: "62%", left: "8%" },
                  { name: "DeepSeek", src: "/logos/deepseek.svg", top: "55%", left: "62%" },
                ].map((model) => (
                  <div
                    key={model.name}
                    className="absolute flex h-24 w-24 items-center justify-center rounded-2xl border border-border bg-white shadow-sm"
                    style={{ top: model.top, left: model.left }}
                  >
                    <Image
                      src={model.src}
                      alt={model.name}
                      width={44}
                      height={44}
                      className="h-11 w-11 object-contain"
                    />
                  </div>
                ))}
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ── Integrations ── */}
      <section className="bg-surface-alt py-24">
        <div className="mx-auto max-w-[1120px] px-4 text-center sm:px-6">
          <ScrollReveal>
            <h2 className="font-display text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
              Envoyer works with the tools you already use
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={0.2} className="mt-12 flex items-center justify-center gap-5">
            {[
              { name: "Google", src: "/logos/google.jpg", large: true },
              { name: "Microsoft", src: "/logos/microsoft.svg" },
              { name: "Shopify", src: "/logos/shopify.svg" },
              { name: "Stripe", src: "/logos/stripe.svg", comingSoon: true },
            ].map((item) => (
              <div key={item.name} className="flex flex-col items-center gap-2">
                <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-border bg-white shadow-sm">
                  <Image
                    src={item.src}
                    alt={item.name}
                    width={"large" in item ? 40 : 32}
                    height={"large" in item ? 40 : 32}
                    className={"large" in item ? "h-10 w-10 object-contain" : "h-8 w-8 object-contain"}
                  />
                </div>
                <span className="font-body text-xs text-text-secondary">
                  {item.name}
                  {"comingSoon" in item && (
                    <span className="ml-1 text-[10px] text-text-secondary/50">
                      soon
                    </span>
                  )}
                </span>
              </div>
            ))}
          </ScrollReveal>
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
