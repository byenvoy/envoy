const pages = [
  {
    title: "Shipping & Returns Policy",
    url: "docs.example.com/shipping-returns",
    preview:
      "All orders ship within 2 business days via USPS Priority Mail. Free returns within 30 days of delivery. Items must be unworn with tags attached...",
    synced: "Mar 28, 2026",
    source: "crawled" as const,
  },
  {
    title: "Getting Started Guide",
    url: "docs.example.com/getting-started",
    preview:
      "Welcome to our platform! This guide walks you through account setup, connecting your first integration, and placing your initial order...",
    synced: "Mar 27, 2026",
    source: "crawled" as const,
  },
  {
    title: "Billing FAQ",
    url: "docs.example.com/billing-faq",
    preview:
      "We accept all major credit cards, PayPal, and Apple Pay. Subscriptions renew automatically on your billing date. To update your payment method...",
    synced: "Mar 26, 2026",
    source: "crawled" as const,
  },
  {
    title: "API Documentation",
    url: "docs.example.com/api",
    preview:
      "Authentication uses Bearer tokens. Rate limits are 100 requests per minute per API key. All endpoints return JSON responses with standard...",
    synced: "Mar 25, 2026",
    source: "crawled" as const,
  },
  {
    title: "Size Guide",
    url: null,
    preview:
      "Our sizing runs true to US standards. Measure your chest, waist, and hips for the best fit. When in between sizes, we recommend sizing up...",
    synced: "Mar 24, 2026",
    source: "upload" as const,
  },
  {
    title: "Warranty Information",
    url: "docs.example.com/warranty",
    preview:
      "All products come with a 1-year limited warranty covering manufacturing defects. Normal wear and tear is not covered. To file a warranty claim...",
    synced: "Mar 23, 2026",
    source: "crawled" as const,
  },
];

const sourceBadge: Record<string, string> = {
  crawled: "Crawled",
  upload: "Uploaded",
};

export function DemoKnowledgeBase() {
  return (
    <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
      {pages.map((page) => (
        <div key={page.title} className="bg-surface p-5">
          <h3 className="mb-1 truncate font-display text-sm font-semibold text-text-primary">
            {page.title}
          </h3>
          {page.url ? (
            <p className="mb-2 truncate font-mono text-[11px] text-text-secondary">
              {page.url}
            </p>
          ) : (
            <p className="mb-2 font-mono text-[11px] text-text-secondary">
              File upload
            </p>
          )}
          <p className="mb-3 line-clamp-2 text-[13px] leading-relaxed text-text-secondary">
            {page.preview}
          </p>
          <div className="flex items-center justify-between">
            <p className="font-mono text-[11px] text-text-secondary">
              Synced {page.synced}
            </p>
            <span className="rounded-full bg-success-light px-2 py-0.5 font-display text-[10px] font-medium text-primary">
              {sourceBadge[page.source]}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
