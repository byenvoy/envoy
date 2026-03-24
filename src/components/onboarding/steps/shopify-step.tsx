"use client";

import { ShopifyConnection } from "@/components/settings/shopify-connection";
import type { Integration } from "@/lib/types/database";

export function ShopifyStep({
  integration,
  hasShopifyClientId,
  onNext,
  onBack,
  onSkip,
}: {
  integration: Integration | null;
  hasShopifyClientId: boolean;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}) {
  return (
    <div>
      <h2 className="mb-2 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Integrations
      </h2>
      <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
        Connect your Shopify store to enrich draft replies with customer order
        history, shipping status, and more.
      </p>

      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-800/50">
        <ShopifyConnection
          integration={integration}
          hasShopifyClientId={hasShopifyClientId}
        />
      </div>

      <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
        Need help connecting?{" "}
        <a
          href="#"
          className="font-medium text-zinc-900 hover:underline dark:text-zinc-50"
        >
          View setup instructions
        </a>
      </p>

      <div className="mt-6 flex items-center justify-between">
        <button
          onClick={onBack}
          className="text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          &larr; Back
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={onSkip}
            className="rounded-lg border border-zinc-300 px-6 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Skip
          </button>
          {integration && (
            <button
              onClick={onNext}
              className="rounded-lg bg-zinc-900 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Continue
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
