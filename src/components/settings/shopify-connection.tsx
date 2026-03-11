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
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
              Shopify — {integration.config.shop_domain}
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Status:{" "}
              <span className="text-emerald-600 dark:text-emerald-400">
                Connected
              </span>
            </p>
          </div>
          <button
            onClick={handleDisconnect}
            disabled={loading}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            {loading ? "Disconnecting..." : "Disconnect"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Connect your Shopify store to enrich support drafts with customer order
        data.
      </p>

      {hasShopifyClientId && !showManual && (
        <div className="space-y-3">
          <div>
            <label
              htmlFor="shop-domain-oauth"
              className="mb-1 block text-sm font-medium text-zinc-900 dark:text-zinc-50"
            >
              Shop domain
            </label>
            <input
              id="shop-domain-oauth"
              type="text"
              placeholder="your-store.myshopify.com"
              value={shopDomain}
              onChange={(e) => setShopDomain(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500"
            />
          </div>
          <a
            href={`/api/integrations/shopify/authorize?shop=${encodeURIComponent(shopDomain)}`}
            className={`inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 ${!shopDomain ? "pointer-events-none opacity-50" : ""}`}
          >
            Connect with Shopify
          </a>
          <button
            type="button"
            onClick={() => setShowManual(true)}
            className="block text-xs text-zinc-500 underline hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
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
              className="mb-1 block text-sm font-medium text-zinc-900 dark:text-zinc-50"
            >
              Shop domain
            </label>
            <input
              id="shop-domain"
              type="text"
              placeholder="your-store.myshopify.com"
              value={shopDomain}
              onChange={(e) => setShopDomain(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500"
            />
          </div>
          <div>
            <label
              htmlFor="access-token"
              className="mb-1 block text-sm font-medium text-zinc-900 dark:text-zinc-50"
            >
              Access token
            </label>
            <input
              id="access-token"
              type="password"
              placeholder="shpat_..."
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500"
            />
          </div>
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading || !shopDomain || !accessToken}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {loading ? "Connecting..." : "Connect"}
          </button>
          {hasShopifyClientId && (
            <button
              type="button"
              onClick={() => setShowManual(false)}
              className="ml-3 text-xs text-zinc-500 underline hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
            >
              Use OAuth instead
            </button>
          )}
        </form>
      )}
    </div>
  );
}
