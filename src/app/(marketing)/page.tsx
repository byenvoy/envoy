import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import Link from "next/link";

export default async function LandingPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (session) {
    redirect("/dashboard");
  }

  return (
    <main>
      {/* Hero */}
      <section className="mx-auto max-w-[1120px] px-4 pb-16 pt-12 sm:px-6 sm:pb-24 sm:pt-28">
        <div className="max-w-2xl">
          <h1 className="font-display text-4xl font-bold leading-tight tracking-tight text-text-primary sm:text-5xl">
            AI customer support
            <br />
            <span className="text-primary">with a human in the loop</span>
          </h1>
          <p className="mt-6 max-w-lg font-body text-lg leading-relaxed text-text-secondary">
            Envoyer crawls your knowledge base, drafts replies to customer
            emails, and lets your team review before anything goes out. One
            flat price, no contracts, no per-seat surprises. Self-hosted or
            managed — your choice.
          </p>
          <div className="mt-10 flex items-center gap-4">
            <Link
              href="/signup"
              className="rounded-lg bg-primary px-6 py-3 font-display text-sm font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Start free trial
            </Link>
            <Link
              href="https://github.com/envoyer/envoyer"
              className="rounded-lg border border-border px-6 py-3 font-display text-sm font-semibold text-text-primary transition-colors hover:bg-surface-alt focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              View on GitHub
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-border bg-surface-alt py-12 sm:py-20">
        <div className="mx-auto max-w-[1120px] px-4 sm:px-6">
          <h2 className="font-display text-2xl font-bold tracking-tight text-text-primary">
            How it works
          </h2>
          <div className="mt-12 grid gap-12 sm:grid-cols-2">
            <div>
              <p className="font-mono text-xs font-medium uppercase tracking-wider text-primary">
                01
              </p>
              <h3 className="mt-3 font-display text-lg font-semibold text-text-primary">
                Connect your knowledge base
              </h3>
              <p className="mt-2 font-body text-[15px] leading-relaxed text-text-secondary">
                Point Envoyer at your support docs, help center, or FAQ pages.
                It crawls, extracts, and embeds the content automatically.
              </p>
            </div>
            <div>
              <p className="font-mono text-xs font-medium uppercase tracking-wider text-primary">
                02
              </p>
              <h3 className="mt-3 font-display text-lg font-semibold text-text-primary">
                Connect your email
              </h3>
              <p className="mt-2 font-body text-[15px] leading-relaxed text-text-secondary">
                Link your Gmail or Outlook support inbox via OAuth. Envoyer
                reads incoming emails and starts drafting replies.
              </p>
            </div>
            <div>
              <p className="font-mono text-xs font-medium uppercase tracking-wider text-primary">
                03
              </p>
              <h3 className="mt-3 font-display text-lg font-semibold text-text-primary">
                AI drafts, you decide
              </h3>
              <p className="mt-2 font-body text-[15px] leading-relaxed text-text-secondary">
                Every incoming email gets a draft reply grounded in your
                knowledge base. Review, edit, or approve — nothing sends without
                a human.
              </p>
            </div>
            <div>
              <p className="font-mono text-xs font-medium uppercase tracking-wider text-primary">
                04
              </p>
              <h3 className="mt-3 font-display text-lg font-semibold text-text-primary">
                Get better over time
              </h3>
              <p className="mt-2 font-body text-[15px] leading-relaxed text-text-secondary">
                Track approval rates, edit patterns, and knowledge gaps. Envoyer
                learns which content is missing and where drafts fall short.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Key differentiators */}
      <section className="py-12 sm:py-20">
        <div className="mx-auto max-w-[1120px] px-4 sm:px-6">
          <h2 className="font-display text-2xl font-bold tracking-tight text-text-primary">
            Why Envoyer
          </h2>
          <div className="mt-12 space-y-8">
            <div className="flex gap-6">
              <div className="hidden w-px shrink-0 bg-primary sm:block" />
              <div>
                <h3 className="font-display text-lg font-semibold text-text-primary">
                  Flat price, no contracts
                </h3>
                <p className="mt-1.5 max-w-lg font-body text-[15px] leading-relaxed text-text-secondary">
                  Most support platforms lock you into annual contracts priced
                  on usage tiers. Envoyer is a flat monthly subscription. Cancel
                  anytime. No sales calls, no negotiation, no surprises on
                  your invoice.
                </p>
              </div>
            </div>
            <div className="flex gap-6">
              <div className="hidden w-px shrink-0 bg-primary sm:block" />
              <div>
                <h3 className="font-display text-lg font-semibold text-text-primary">
                  Does one thing well
                </h3>
                <p className="mt-1.5 max-w-lg font-body text-[15px] leading-relaxed text-text-secondary">
                  No chatbot builder, no ticketing workflow engine, no CRM
                  bolted on. Envoyer reads your customers&apos; emails, drafts
                  replies from your knowledge base, and lets your team send
                  them. That&apos;s it.
                </p>
              </div>
            </div>
            <div className="flex gap-6">
              <div className="hidden w-px shrink-0 bg-primary sm:block" />
              <div>
                <h3 className="font-display text-lg font-semibold text-text-primary">
                  Stay close to your customers
                </h3>
                <p className="mt-1.5 max-w-lg font-body text-[15px] leading-relaxed text-text-secondary">
                  Every draft goes through a human before it reaches the
                  customer. Your team catches what the AI misses, adds the
                  personal touch that matters, and keeps a finger on the pulse
                  of what customers actually need. AI handles the first draft —
                  your people handle the relationship.
                </p>
              </div>
            </div>
            <div className="flex gap-6">
              <div className="hidden w-px shrink-0 bg-primary sm:block" />
              <div>
                <h3 className="font-display text-lg font-semibold text-text-primary">
                  Pick your model, keep your margin
                </h3>
                <p className="mt-1.5 max-w-lg font-body text-[15px] leading-relaxed text-text-secondary">
                  Choose between Claude, GPT-4o, Gemini, and more — optimize
                  for quality or cost, your call. Zero markup on model costs.
                  Track spending per ticket, set daily limits, and get granular
                  breakdowns of exactly where your AI budget goes.
                </p>
              </div>
            </div>
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
              envoyer
            </p>
            <div className="flex items-center gap-6">
              <Link
                href="/pricing"
                className="font-body text-sm text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Pricing
              </Link>
              <Link
                href="https://github.com/envoyer/envoyer"
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
