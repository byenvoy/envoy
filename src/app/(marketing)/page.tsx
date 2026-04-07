import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import Link from "next/link";
import Image from "next/image";
import { DemoInbox } from "@/components/marketing/demo-inbox";
import { DemoSetupPanels } from "@/components/marketing/demo-setup-panels";
import { DemoAutopilot } from "@/components/marketing/demo-autopilot";
import { ScrollReveal } from "@/components/marketing/scroll-reveal";

export default async function LandingPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (session) {
    redirect("/dashboard");
  }

  return (
    <main className="relative overflow-hidden">
      {/* ── Hero ── */}
      <section className="relative pb-0 pt-20 sm:pt-28">
        <div className="mx-auto max-w-[800px] px-4 text-center sm:px-6">
          <ScrollReveal>
            <h1 className="font-display text-4xl font-bold leading-[1.08] tracking-tight text-primary-dark sm:text-5xl lg:text-6xl">
              Support that runs itself
            </h1>
            {/* <p className="mx-auto mt-5 max-w-lg font-body text-lg leading-relaxed text-text-secondary">
              AI that reads your docs, drafts replies, and lets your team send
              them. Human touch, AI speed.
            </p> */}
            <div className="mt-8">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-8 py-3.5 font-display text-base font-semibold text-white transition-colors hover:bg-primary-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Start free trial
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── Inbox Demo ── */}
      <section className="relative pb-12 pt-16 sm:pt-20">
        <div className="mx-auto max-w-[1120px] px-4 sm:px-6">
          <ScrollReveal direction="up">
            <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-[0_4px_6px_-1px_rgba(0,0,0,0.04),0_20px_50px_-12px_rgba(0,0,0,0.08)]">
              <DemoInbox />
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
          ].map((item) => (
            <div key={item.title}>
              <h3 className="font-display text-xl font-bold text-text-primary">
                {item.title}
              </h3>
              <p className="mt-2 max-w-[250px] font-body text-base leading-relaxed text-text-secondary">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Autopilot ── */}
      <section className="py-16">
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
                    Knows when to ask
                  </h3>
                  <p className="mt-1 max-w-sm font-body text-base leading-relaxed text-text-secondary">
                    If Autopilot isn&apos;t too sure, it routes the draft to
                    you for approval. Your team is always in control.
                  </p>
                </div>
              </div>
            </ScrollReveal>
            <ScrollReveal>
              <DemoAutopilot />
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ── Get Started ── */}
      <section className="py-16">
        <div className="mx-auto max-w-[1120px] px-4 sm:px-6">
          <ScrollReveal>
            <h2 className="font-display text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
              Up and running in minutes
            </h2>
          </ScrollReveal>
          <ScrollReveal className="mt-14">
            <DemoSetupPanels />
          </ScrollReveal>
        </div>
      </section>

      {/* ── Anti-bloat ── */}
      <section className="py-16">
        <div className="mx-auto max-w-[1120px] px-4 sm:px-6">
          <div className="max-w-2xl">
            <ScrollReveal>
              <h2 className="font-display text-3xl font-bold tracking-tight text-text-primary sm:text-[40px] sm:leading-[1.15]">
                Everything you need
                <br />
                Nothing you don&apos;t
              </h2>
              <ul className="mt-8 flex flex-col gap-3">
                {[
                  "Ticket queues to configure",
                  "Routing rules to maintain",
                  "Chatbot decision trees to map out",
                  "Workflows to debug when they break",
                  "Features you'll never use",
                ].map((item) => (
                  <li
                    key={item}
                    className="font-body text-lg text-text-primary line-through decoration-border decoration-[1.5px]"
                  >
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-4 font-display text-lg font-semibold text-primary">
                Envoyer answers your customers. You run your business.
              </p>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section className="py-16">
        <div className="mx-auto max-w-[1120px] px-4 sm:px-6">
          <div className="grid items-center gap-14 lg:grid-cols-2">
            <ScrollReveal>
              <h2 className="font-display text-3xl font-bold tracking-tight text-text-primary sm:text-[40px] sm:leading-[1.15]">
                Pricing that makes sense
              </h2>
              <p className="mt-6 font-display text-xl font-semibold leading-snug text-text-primary sm:text-2xl">
                No per-seat fees. No per-resolution charges. No upfront
                contracts.
              </p>
              <p className="mt-8 max-w-md font-body text-base leading-relaxed text-text-secondary">
                Most AI support tools mark up model costs 5-10x and hide it
                behind per-outcome pricing. Envoyer passes through model costs
                directly with zero markup. Pick your own model based on your
                needs. You see exactly what each response costs. Set your own
                spend limits.
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
            <ScrollReveal>
              <p className="font-display text-sm font-semibold text-text-secondary">
                Pick any model. Switch anytime.
              </p>
              <p className="mt-1 font-mono text-xs text-text-secondary">
                Zero markup. You pay what the provider charges.
              </p>
              <div className="mt-5 flex flex-wrap gap-4">
                {[
                  { name: "Claude", src: "/logos/anthropic.svg" },
                  { name: "GPT-4o", src: "/logos/openai.svg" },
                  { name: "Gemini", src: "/logos/gemini-icon.png" },
                  { name: "Mistral", src: "/logos/mistral.svg" },
                  { name: "DeepSeek", src: "/logos/deepseek.svg" },
                ].map((model) => (
                  <div
                    key={model.name}
                    className="flex h-20 w-20 items-center justify-center rounded-2xl border border-border bg-white shadow-sm"
                  >
                    <Image
                      src={model.src}
                      alt={model.name}
                      width={40}
                      height={40}
                      className="h-10 w-10 object-contain"
                    />
                  </div>
                ))}
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ── Integrations ── */}
      <section className="py-16">
        <div className="mx-auto max-w-[1120px] px-4 text-center sm:px-6">
          <ScrollReveal>
            <h2 className="font-display text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
              Works with the tools you use
            </h2>
            <div className="mt-12 flex items-center justify-center gap-6">
              {[
                { name: "Google", src: "/logos/google-icon.svg" },
                { name: "Microsoft", src: "/logos/microsoft.svg" },
                { name: "Shopify", src: "/logos/shopify.svg" },
                { name: "Stripe", src: "/logos/stripe.svg", comingSoon: true },
              ].map((item) => (
                <div
                  key={item.name}
                  className="flex flex-col items-center gap-2.5"
                >
                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-border bg-white shadow-sm">
                    <Image
                      src={item.src}
                      alt={item.name}
                      width={40}
                      height={40}
                      className="h-10 w-10 object-contain"
                    />
                  </div>
                  <span className="font-body text-sm text-text-secondary">
                    {item.name}
                    {"comingSoon" in item && (
                      <span className="ml-1 text-xs text-text-secondary/50">
                        soon
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="bg-surface-alt py-24">
        <div className="mx-auto max-w-xl px-4 text-center sm:px-6">
          <ScrollReveal>
            <h2 className="font-display text-3xl font-bold tracking-tight text-text-primary sm:text-5xl">
              Ready to get started?
            </h2>
            <p className="mt-4 font-body text-base leading-relaxed text-text-secondary">
              See it for yourself. Get started in minutes.
            </p>
            <div className="mt-8">
              <Link
                href="/signup"
                className="rounded-md bg-primary px-8 py-3.5 font-body text-base font-semibold text-white transition-colors hover:bg-primary-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Try Envoyer free
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border py-12">
        <div className="mx-auto max-w-[1120px] px-4 sm:px-6">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <span className="font-display text-base font-bold text-text-secondary">
                envoyer
              </span>
              <p className="mt-2 max-w-xs font-body text-sm leading-relaxed text-text-secondary">
                AI customer support with a human in the loop when it matters. Open source,
                self-hosted or managed.
              </p>
            </div>
            <div className="flex gap-12">
              <div>
                <p className="font-display text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  Product
                </p>
                <div className="mt-3 flex flex-col gap-2">
                  <Link
                    href="/pricing"
                    className="font-body text-sm text-text-secondary transition-colors hover:text-text-primary"
                  >
                    Pricing
                  </Link>
                  <Link
                    href="/login"
                    className="font-body text-sm text-text-secondary transition-colors hover:text-text-primary"
                  >
                    Log in
                  </Link>
                  <Link
                    href="/signup"
                    className="font-body text-sm text-text-secondary transition-colors hover:text-text-primary"
                  >
                    Sign up
                  </Link>
                </div>
              </div>
              <div>
                <p className="font-display text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  Resources
                </p>
                <div className="mt-3 flex flex-col gap-2">
                  <Link
                    href="https://github.com/envoyer/envoyer"
                    className="font-body text-sm text-text-secondary transition-colors hover:text-text-primary"
                  >
                    GitHub
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
