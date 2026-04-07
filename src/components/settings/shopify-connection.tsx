"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Integration } from "@/lib/types/database";

export function ShopifyConnection({
  integration,
  hasShopifyClientId,
}: {
  integration: Integration | null;
  hasShopifyClientId: boolean;
}) {
  const router = useRouter();
  const [shopDomain, setShopDomain] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(!hasShopifyClientId);

  async function handleDisconnect() {
    setLoading(true);
    try {
      const res = await fetch("/api/integrations/shopify/disconnect", {
        method: "POST",
      });
      if (res.ok) router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleManualConnect(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/shopify/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shop_domain: shopDomain, access_token: accessToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to connect");
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (integration) {
    return (
      <div className="rounded-lg border border-primary bg-success-light p-5 text-center">
        <div className="flex items-center justify-center gap-2">
          <svg className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
          <span className="font-display text-sm font-semibold text-primary">
            Shopify connected
          </span>
        </div>
        <p className="mt-1 truncate font-mono text-xs text-text-secondary">
          {integration.config.shop_domain}
        </p>
        <button
          onClick={handleDisconnect}
          disabled={loading}
          className="mt-3 text-[11px] text-text-secondary/60 transition-colors hover:text-error"
        >
          {loading ? "Disconnecting..." : "Disconnect"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-display font-medium text-text-primary">Shopify</h3>
      <p className="text-sm text-text-secondary">
        Connect your Shopify store to pull order details, customer history, and product data into customer context to enhance drafted and auto-sent support emails.
      </p>
      {hasShopifyClientId && !showManual && (
        <div className="space-y-1">
          <label
            htmlFor="shop-domain-oauth"
            className="mb-1 block font-display text-sm font-medium text-text-primary"
          >
            Shop domain
          </label>
          <div className="space-y-2 sm:space-y-0">
            <div className="flex overflow-hidden rounded-lg border border-border bg-surface-alt focus-within:border-primary focus-within:ring-1 focus-within:ring-primary sm:rounded-r-none">
              <input
                id="shop-domain-oauth"
                type="text"
                placeholder="your-store.myshopify.com"
                value={shopDomain}
                onChange={(e) => setShopDomain(e.target.value)}
                className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none"
              />
              <a
                href={`/api/integrations/shopify/authorize?shop=${encodeURIComponent(shopDomain)}`}
                className={`hidden sm:flex items-center gap-2 bg-surface px-5 font-display text-sm font-medium text-text-primary transition-colors hover:bg-border ${!shopDomain ? "pointer-events-none opacity-50" : ""}`}
              >
                Connect
              </a>
            </div>
            <a
              href={`/api/integrations/shopify/authorize?shop=${encodeURIComponent(shopDomain)}`}
              className={`flex items-center justify-center rounded-lg bg-primary px-4 py-2 font-display text-sm font-medium text-white transition-colors hover:bg-primary-dark sm:hidden ${!shopDomain ? "pointer-events-none opacity-50" : ""}`}
            >
              Connect
            </a>
          </div>
          <button
            type="button"
            onClick={() => setShowManual(true)}
            className="rounded px-2 py-1.5 text-[13px] font-medium text-text-secondary transition-colors hover:text-text-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
          >
            Or enter access token manually
          </button>
        </div>
      )}

      {(showManual || !hasShopifyClientId) && (
        <form onSubmit={handleManualConnect} className="space-y-3">
          <div>
            <label
              htmlFor="shop-domain"
              className="mb-1 block text-sm font-display font-medium text-text-primary"
            >
              Shop domain
            </label>
            <input
              id="shop-domain"
              type="text"
              placeholder="your-store.myshopify.com"
              value={shopDomain}
              onChange={(e) => setShopDomain(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface-alt px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
            />
          </div>
          <div>
            <label
              htmlFor="access-token"
              className="mb-1 block text-sm font-display font-medium text-text-primary"
            >
              Access token
            </label>
            <input
              id="access-token"
              type="password"
              placeholder="shpat_..."
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface-alt px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
            />
          </div>
          {error && (
            <p className="text-sm text-error">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading || !shopDomain || !accessToken}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
          >
            {loading ? "Connecting..." : "Connect"}
          </button>
          {hasShopifyClientId && (
            <button
              type="button"
              onClick={() => setShowManual(false)}
              className="ml-1 rounded px-2 py-1.5 text-[13px] font-medium text-text-secondary transition-colors hover:text-text-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
            >
              Use OAuth instead
            </button>
          )}
        </form>
      )}
    </div>
  );
}
