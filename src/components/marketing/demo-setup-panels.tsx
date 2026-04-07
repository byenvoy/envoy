import Image from "next/image";

function SourcesPanel() {
  return (
    <div className="h-full rounded-xl border border-border bg-white p-5">
      <h3 className="font-display text-lg font-semibold text-text-primary">
        <span className="font-mono text-lg font-medium text-primary">1.</span>{" "}
        Add sources
      </h3>
      <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">
        Point Envoyer at your internal docs and support pages. Changes sync automatically.
      </p>
      <div className="mt-4 flex flex-wrap gap-2.5">
        <span className="rounded-lg bg-primary px-4 py-2 font-display text-sm font-semibold text-white">
          Find pages by domain
        </span>
        <span className="rounded-lg border border-border px-4 py-2 font-display text-sm font-medium text-text-primary">
          Upload document
        </span>
        <span className="rounded-lg border border-border px-4 py-2 font-display text-sm font-medium text-text-primary">
          Custom entry
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4">
        {[
          { title: "Shipping & Delivery", url: "/help/shipping", synced: "Synced 2h ago" },
          { title: "Returns & Refunds", url: "/help/returns", synced: "Synced 2h ago" },
          { title: "Order Tracking", url: "/help/tracking", synced: "Synced 2h ago", mobileHidden: true },
          { title: "Payment Methods", url: "/help/payments", synced: "Synced 5h ago", mobileHidden: true },
          { title: "Product Care", url: "/help/care", synced: "Synced 1d ago" },
          { title: "Warranty Policy", url: "/help/warranty", synced: "Synced 1d ago" },
          { title: "Store Policies", url: "store-policies.pdf", synced: "Synced 1d ago" },
          { title: "Contact & Hours", url: "/help/contact", synced: "Synced 6h ago" },
        ].map((page) => (
          <div
            key={page.title}
            className={`rounded-lg border border-border bg-surface p-5${page.mobileHidden ? " hidden sm:block" : ""}`}
          >
            <p className="font-body text-sm font-medium text-text-primary">
              {page.title}
            </p>
            <p className="mt-0.5 font-mono text-[10px] text-text-secondary">
              {page.url}
            </p>
            <p className="mt-1.5 font-mono text-[10px] text-text-secondary">
              {page.synced}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function IntegrationsPanel() {
  return (
    <div className="rounded-xl border border-border bg-white p-5">
      <h3 className="font-display text-lg font-semibold text-text-primary">
        <span className="font-mono text-lg font-medium text-primary">2.</span>{" "}
        Connect your inbox and integrations
      </h3>
      <div className="mt-3 space-y-2">
        <div className="flex items-center gap-3 rounded-lg border border-primary-light bg-success-light px-3 py-2">
          <Image src="/logos/google-icon.svg" alt="Google" width={20} height={20} className="h-5 w-5 rounded object-contain" />
          <div className="flex-1">
            <p className="text-sm font-medium text-text-primary">Google</p>
            <p className="font-mono text-[11px] text-text-secondary">support@example.com</p>
          </div>
          <span className="text-[11px] font-medium text-primary">Connected</span>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-primary-light bg-success-light px-3 py-2">
          <Image src="/logos/shopify.svg" alt="Shopify" width={20} height={20} className="h-5 w-5 object-contain" />
          <div className="flex-1">
            <p className="text-sm font-medium text-text-primary">Shopify</p>
            <p className="font-mono text-[11px] text-text-secondary">example-store.myshopify.com</p>
          </div>
          <span className="text-[11px] font-medium text-primary">Connected</span>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-dashed border-border px-3 py-2">
          <Image src="/logos/stripe.svg" alt="Stripe" width={20} height={20} className="h-5 w-5 object-contain opacity-50" />
          <div className="flex-1">
            <p className="text-sm font-medium text-text-secondary">Stripe</p>
          </div>
          <span className="text-[11px] text-text-secondary">Soon</span>
        </div>
      </div>
    </div>
  );
}

function ResultsPanel() {
  return (
    <div className="rounded-xl border border-border bg-white p-5">
      <h3 className="font-display text-lg font-semibold text-text-primary">
        <span className="font-mono text-lg font-medium text-primary">3.</span>{" "}
        Envoyer takes it from there
      </h3>
      <div className="mt-3 space-y-2">
        {[
          { name: "Sarah M.", subject: "Where's my order?", badge: "Draft ready", badgeClass: "bg-ai-accent-light text-[#8B6914]" },
          { name: "James R.", subject: "Subscription plan change", badge: "Auto-sent", badgeClass: "bg-success-light text-primary" },
          { name: "Mia F.", subject: "Return request #4821", badge: "Draft ready", badgeClass: "bg-ai-accent-light text-[#8B6914]" },
          { name: "Alex T.", subject: "Do you ship to Canada?", badge: "Auto-sent", badgeClass: "bg-success-light text-primary" },
          { name: "Hannah C.", subject: "Warranty claim", badge: "Auto-sent", badgeClass: "bg-success-light text-primary" },
        ].map((item) => (
          <div
            key={item.name}
            className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <p className="font-display text-[13px] font-semibold text-text-primary">
                {item.name}
              </p>
              <p className="truncate text-[13px] text-text-secondary">
                {item.subject}
              </p>
            </div>
            <span className={`ml-2 flex-shrink-0 rounded-sm px-2 py-0.5 text-[10px] font-medium ${item.badgeClass}`}>
              {item.badge}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DemoSetupPanels() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Large left panel */}
      <div>
        <SourcesPanel />
      </div>
      {/* Two right panels stacked */}
      <div className="flex flex-col gap-4">
        <IntegrationsPanel />
        <ResultsPanel />
      </div>
    </div>
  );
}
