import Link from "next/link";

const TIERS = [
  {
    name: "Self-Hosted",
    price: "Free",
    priceDetail: "forever",
    description:
      "Run Envoyer on your own infrastructure. Same codebase, full control.",
    features: [
      "Unlimited everything",
      "Bring your own LLM keys",
      "Docker Compose deployment",
      "All integrations included",
      "Community support",
    ],
    cta: "View on GitHub",
    ctaHref: "https://github.com/envoyer/envoyer",
    highlight: false,
  },
  {
    name: "Pro",
    price: "$15",
    priceDetail: "/month",
    description:
      "Managed hosting with everything included. No infrastructure to maintain.",
    features: [
      "Unlimited tickets",
      "Unlimited knowledge base pages",
      "Unlimited team members",
      "LLM costs included",
      "All integrations included",
      "14-day free trial",
      "Email support",
    ],
    cta: "Start free trial",
    ctaHref: "/signup",
    highlight: true,
  },
];

export default function PricingPage() {
  return (
    <main className="mx-auto max-w-[1120px] px-4 pb-16 pt-12 sm:px-6 sm:pb-24 sm:pt-20">
      <div className="max-w-2xl">
        <h1 className="font-display text-4xl font-bold tracking-tight text-text-primary">
          Pricing
        </h1>
        <p className="mt-4 font-body text-lg leading-relaxed text-text-secondary">
          Self-host for free, or let us run it for you. One flat price, no
          contracts, no per-seat charges.
        </p>
      </div>

      <div className="mx-auto mt-16 grid max-w-2xl gap-6 sm:grid-cols-2">
        {TIERS.map((tier) => (
          <div
            key={tier.name}
            className={`rounded-lg border p-6 ${
              tier.highlight
                ? "border-primary bg-success-light"
                : "border-border bg-surface"
            }`}
          >
            <p className="font-display text-sm font-semibold uppercase tracking-wider text-text-secondary">
              {tier.name}
            </p>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="font-display text-4xl font-bold tracking-tight text-text-primary">
                {tier.price}
              </span>
              <span className="font-body text-sm text-text-secondary">
                {tier.priceDetail}
              </span>
            </div>
            <p className="mt-3 font-body text-[15px] leading-relaxed text-text-secondary">
              {tier.description}
            </p>
            <Link
              href={tier.ctaHref}
              className={`mt-6 block rounded-lg px-4 py-3 text-center font-display text-sm font-semibold transition-opacity hover:opacity-90 ${
                tier.highlight
                  ? "bg-primary text-white"
                  : "border border-border bg-surface text-text-primary hover:bg-surface-alt"
              }`}
            >
              {tier.cta}
            </Link>
            <ul className="mt-8 space-y-3">
              {tier.features.map((feature) => (
                <li
                  key={feature}
                  className="flex items-start gap-2.5 font-body text-[15px] text-text-primary"
                >
                  <span className="mt-0.5 text-primary">&#10003;</span>
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-16 rounded-lg border border-border bg-surface-alt p-6">
        <h2 className="font-display text-lg font-semibold text-text-primary">
          Questions?
        </h2>
        <p className="mt-2 font-body text-[15px] leading-relaxed text-text-secondary">
          Have a question about pricing or need something custom? Reach out and
          we&apos;ll help.
        </p>
        <a
          href="mailto:hello@envoyer.sh"
          className="mt-4 inline-block font-display text-sm font-semibold text-primary transition-opacity hover:opacity-80"
        >
          Contact us &rarr;
        </a>
      </div>
    </main>
  );
}
