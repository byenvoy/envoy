import Image from "next/image";
import Link from "next/link";

const TIERS = [
  {
    name: "Self-Hosted",
    price: "Free",
    priceDetail: "",
    description:
      "Run Envoy on your own infrastructure. Same codebase, full control.",
    features: [
      "Docker Compose deployment",
      "All integrations included",
      "Community support",
    ],
    cta: "View on GitHub",
    ctaHref: "https://github.com/byenvoy/envoy",
    highlight: false,
    mobileOrder: "order-last",
  },
  {
    name: "Pro",
    price: "$15",
    priceDetail: "/month",
    description:
      "Managed hosting with everything included. No infrastructure to maintain.",
    features: [
      "Unlimited messages",
      "Unlimited team members",
      "Unlimited knowledge base pages",
      "Automatic updates",
      "All integrations included",
      "Seamless set up",
      "14-day free trial",
      "Email support",
    ],
    cta: "Start free trial",
    ctaHref: "/signup",
    highlight: true,
    mobileOrder: "order-first",
  },
];

export default function PricingPage() {
  return (
    <main className="mx-auto max-w-[1120px] px-4 pb-16 pt-12 sm:px-6 sm:pb-24 sm:pt-20">
      <div className="mx-auto max-w-xl text-center">
        <h1 className="font-display text-4xl font-bold tracking-tight text-text-primary sm:text-5xl">
          Pricing
        </h1>
        <p className="mt-4 font-body text-lg leading-relaxed text-text-secondary">
          Self-host for free, or let us run it for you. One flat price, no
          contracts, no per-seat charges, no per-resolution charges.
        </p>
      </div>

      <div className="mx-auto mt-16 grid max-w-[720px] gap-6 sm:grid-cols-2">
        {TIERS.map((tier) => (
          <div
            key={tier.name}
            className={`rounded-xl border p-6 transition-shadow hover:shadow-lg sm:order-none sm:p-9 ${tier.mobileOrder} ${
              tier.highlight
                ? "border-primary bg-gradient-to-b from-success-light/30 to-surface"
                : "border-border bg-white hover:border-primary-light"
            }`}
          >
            <p
              className={`font-display text-[11px] font-semibold uppercase tracking-widest ${
                tier.highlight ? "text-primary" : "text-text-secondary"
              }`}
            >
              {tier.name}
            </p>
            <div className="mt-5 flex items-baseline gap-1">
              <span className="font-display text-[44px] font-bold leading-none tracking-tight text-text-primary">
                {tier.price}
              </span>
              <span className="font-body text-[15px] text-text-secondary">
                {tier.priceDetail}
              </span>
            </div>
            <p className="mt-3 font-body text-[15px] leading-relaxed text-text-secondary">
              {tier.description}
            </p>
            <Link
              href={tier.ctaHref}
              className={`mt-7 flex h-12 items-center justify-center rounded-lg px-5 font-display text-sm font-semibold transition-opacity hover:opacity-90 ${
                tier.highlight
                  ? "border border-transparent bg-primary text-white"
                  : "border border-border bg-white text-text-primary hover:bg-surface-alt"
              }`}
            >
              {!tier.highlight && (
                <Image
                  src="/logos/GitHub_Invertocat_Black.svg"
                  alt=""
                  width={24}
                  height={24}
                  className="mr-2 inline-block"
                />
              )}
              {tier.cta}
            </Link>
            <ul className="mt-8 space-y-0">
              {tier.features.map((feature, i) => (
                <li
                  key={feature}
                  className={`flex items-start gap-2.5 py-2 font-body text-[15px] text-text-primary ${
                    i > 0 ? "border-t border-surface-alt" : ""
                  }`}
                >
                  <span className="mt-0.5 text-primary">&#10003;</span>
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </main>
  );
}
