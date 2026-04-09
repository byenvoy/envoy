import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import Link from "next/link";
import { DemoInbox } from "@/components/marketing/demo-inbox";
import { DemoKnowledgeBase } from "@/components/marketing/demo-knowledge-base";
import { DemoDashboardStats } from "@/components/marketing/demo-dashboard-stats";
import {
  IntegrationLogos,
  ModelLogos,
} from "@/components/marketing/integration-logos";

export default async function LandingPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (session) {
    redirect("/dashboard");
  }

  return (
    <main>
      {/* Hero + Inbox Demo */}
      <section className="pb-12 pt-12 sm:pb-20 sm:pt-28">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
          <div className="max-w-2xl">
            <h1 className="font-display text-4xl font-bold leading-tight tracking-tight text-text-primary sm:text-5xl">
              AI drafts.
              <br />
              <span className="text-primary">Your team delivers.</span>
            </h1>
            <p className="mt-6 max-w-lg font-body text-lg leading-relaxed text-text-secondary">
              Envoy crawls your knowledge base and drafts replies to customer
              emails in seconds. Your team reviews every message before it goes
              out — keeping the human touch your customers expect.
            </p>
            <div className="mt-10 flex items-center gap-4">
              <Link
                href="/signup"
                className="rounded-lg bg-primary px-6 py-3 font-display text-sm font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Start free trial
              </Link>
              <Link
                href="https://github.com/envoy/envoy"
                className="rounded-lg border border-border px-6 py-3 font-display text-sm font-semibold text-text-primary transition-colors hover:bg-surface-alt focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                View on GitHub
              </Link>
            </div>
          </div>
          <div className="mt-12 sm:mt-16">
            <DemoInbox />
          </div>
        </div>
      </section>

      {/* Built for small teams */}
      <section className="py-12 sm:py-20">
        <div className="mx-auto max-w-[1120px] px-4 sm:px-6">
          <h2 className="font-display text-2xl font-bold tracking-tight text-text-primary">
            Built for small teams
          </h2>
          <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:gap-12">
            <div>
              <h3 className="font-display text-lg font-semibold text-text-primary">
                Does one thing well
              </h3>
              <p className="mt-1.5 font-body text-[15px] leading-relaxed text-text-secondary">
                No chatbot builder, no ticketing workflow engine, no CRM bolted
                on. Envoy reads your customers&apos; emails, drafts replies
                from your docs, and lets you send them. That&apos;s it.
              </p>
            </div>
            <div>
              <h3 className="font-display text-lg font-semibold text-text-primary">
                Solo founders to small support teams
              </h3>
              <p className="mt-1.5 font-body text-[15px] leading-relaxed text-text-secondary">
                Whether you&apos;re a solo entrepreneur answering every
                email yourself, a Shopify store scaling up, or a small SaaS
                team — Envoy handles the drafting so you can focus on
                the conversation.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Demo: Knowledge Base */}
      <section className="border-t border-border bg-surface-alt py-12 sm:py-20">
        <div className="mx-auto max-w-[1120px] px-4 sm:px-6">
          <p className="font-mono text-xs font-medium uppercase tracking-wider text-primary">
            Knowledge base
          </p>
          <h2 className="mt-3 font-display text-2xl font-bold tracking-tight text-text-primary">
            Point it at your docs
          </h2>
          <p className="mt-2 max-w-lg font-body text-[15px] leading-relaxed text-text-secondary">
            Give Envoy a URL and it crawls your help center, FAQ, or support
            docs. Upload files or add content manually. Every draft is grounded
            in what you&apos;ve actually written.
          </p>
          <div className="mt-10">
            <DemoKnowledgeBase />
          </div>
        </div>
      </section>

      {/* Integrations */}
      <section className="py-12 sm:py-20">
        <div className="mx-auto max-w-[1120px] px-4 sm:px-6">
          <h2 className="font-display text-2xl font-bold tracking-tight text-text-primary">
            Connects to what you already use
          </h2>
          <p className="mt-2 max-w-lg font-body text-[15px] leading-relaxed text-text-secondary">
            Link your email, pull in customer context from Shopify, and deploy
            however you want. More integrations coming soon.
          </p>
          <div className="mt-10">
            <IntegrationLogos />
          </div>
        </div>
      </section>

      {/* Your terms */}
      <section className="border-t border-border bg-surface-alt py-12 sm:py-20">
        <div className="mx-auto max-w-[1120px] px-4 sm:px-6">
          <h2 className="font-display text-2xl font-bold tracking-tight text-text-primary">
            Your terms
          </h2>
          <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:gap-12">
            <div>
              <h3 className="font-display text-lg font-semibold text-text-primary">
                No upfront contracts
              </h3>
              <p className="mt-1.5 font-body text-[15px] leading-relaxed text-text-secondary">
                Flat monthly subscription. Cancel anytime. No sales calls, no
                negotiation, no surprises on your invoice.
              </p>
            </div>
            <div>
              <h3 className="font-display text-lg font-semibold text-text-primary">
                Pick your own model
              </h3>
              <p className="mt-1.5 font-body text-[15px] leading-relaxed text-text-secondary">
                Choose between Claude, GPT-4o, Gemini, Mistral, and more.
                Optimize for quality or cost — your call.
              </p>
              <div className="mt-4">
                <ModelLogos />
              </div>
            </div>
            <div>
              <h3 className="font-display text-lg font-semibold text-text-primary">
                Track every dollar
              </h3>
              <p className="mt-1.5 font-body text-[15px] leading-relaxed text-text-secondary">
                Zero markup on model costs. See spending per ticket, set daily
                limits, and get granular breakdowns of where your AI budget
                goes.
              </p>
            </div>
            <div>
              <h3 className="font-display text-lg font-semibold text-text-primary">
                Customize tone and auto-replies
              </h3>
              <p className="mt-1.5 font-body text-[15px] leading-relaxed text-text-secondary">
                Set the voice — professional, casual, technical, friendly. Add
                custom greetings, sign-offs, and instructions. Every draft
                sounds like your team wrote it.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Demo: Dashboard */}
      <section className="py-12 sm:py-20">
        <div className="mx-auto max-w-[1120px] px-4 sm:px-6">
          <p className="font-mono text-xs font-medium uppercase tracking-wider text-primary">
            Dashboard
          </p>
          <h2 className="mt-3 font-display text-2xl font-bold tracking-tight text-text-primary">
            Full visibility into cost and quality
          </h2>
          <p className="mt-2 max-w-lg font-body text-[15px] leading-relaxed text-text-secondary">
            Track approval rates, model costs, and draft volume at a glance.
            Know exactly what you&apos;re spending and how well your AI is
            performing.
          </p>
          <div className="mt-10">
            <DemoDashboardStats />
          </div>
        </div>
      </section>

      {/* Benefits to your customers */}
      <section className="border-t border-border bg-surface-alt py-12 sm:py-20">
        <div className="mx-auto max-w-[1120px] px-4 sm:px-6">
          <h2 className="font-display text-2xl font-bold tracking-tight text-text-primary">
            Better for your customers too
          </h2>
          <div className="mt-10 grid gap-8 sm:grid-cols-3 lg:gap-12">
            <div>
              <h3 className="font-display text-lg font-semibold text-text-primary">
                Faster responses
              </h3>
              <p className="mt-1.5 font-body text-[15px] leading-relaxed text-text-secondary">
                Drafts are ready the moment an email arrives. Your team reviews
                and sends — cutting response times from hours to minutes.
              </p>
            </div>
            <div>
              <h3 className="font-display text-lg font-semibold text-text-primary">
                Accurate answers
              </h3>
              <p className="mt-1.5 font-body text-[15px] leading-relaxed text-text-secondary">
                Every reply is grounded in your actual documentation — not
                hallucinated. Source citations show exactly where each answer
                came from.
              </p>
            </div>
            <div>
              <h3 className="font-display text-lg font-semibold text-text-primary">
                Consistent quality
              </h3>
              <p className="mt-1.5 font-body text-[15px] leading-relaxed text-text-secondary">
                Same tone, same accuracy, every time. Whether it&apos;s your
                first ticket of the day or your hundredth, the quality stays
                high.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Hosted offering */}
      <section className="py-12 sm:py-20">
        <div className="mx-auto max-w-[1120px] px-4 sm:px-6">
          <div className="max-w-lg">
            <h2 className="font-display text-2xl font-bold tracking-tight text-text-primary">
              Hosted or self-hosted
            </h2>
            <p className="mt-3 font-body text-[15px] leading-relaxed text-text-secondary">
              Start with our managed service — zero setup, we handle the
              infrastructure. Or deploy it yourself in minutes with Docker
              Compose. Same codebase, same features, your choice.
            </p>
            <p className="mt-3 font-body text-[15px] leading-relaxed text-text-secondary">
              We&apos;re not going anywhere. Envoy is open source and built to
              last. Your data stays yours regardless of how you run it.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border bg-surface-alt py-12 sm:py-20">
        <div className="mx-auto max-w-[1120px] px-4 text-center sm:px-6">
          <h2 className="font-display text-2xl font-bold tracking-tight text-text-primary">
            Ready to try it?
          </h2>
          <p className="mx-auto mt-4 max-w-md font-body text-[15px] leading-relaxed text-text-secondary">
            Start with the hosted version — no setup required. Or deploy it
            yourself in minutes with Docker Compose.
          </p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <Link
              href="/signup"
              className="rounded-lg bg-primary px-6 py-3 font-display text-sm font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Start free trial
            </Link>
            <Link
              href="/pricing"
              className="rounded-lg border border-border px-6 py-3 font-display text-sm font-semibold text-text-primary transition-colors hover:bg-surface-alt focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              View pricing
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-10">
        <div className="mx-auto max-w-[1120px] px-4 sm:px-6">
          <div className="flex items-center justify-between">
            <p className="font-display text-sm font-bold tracking-tight text-primary">
              envoy
            </p>
            <div className="flex items-center gap-6">
              <Link
                href="/pricing"
                className="font-body text-sm text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Pricing
              </Link>
              <Link
                href="https://github.com/envoy/envoy"
                className="font-body text-sm text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
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
