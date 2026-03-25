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
    <div className="text-center">
      <h2 className="mb-2 font-display text-2xl font-bold tracking-tight text-text-primary">
        Connect Shopify
      </h2>
      <p className="mb-8 text-sm text-text-secondary">
        Enrich draft replies with customer order history, shipping status, and more.
        This step is optional.
      </p>

      <div className="text-left">
        <ShopifyConnection
          integration={integration}
          hasShopifyClientId={hasShopifyClientId}
        />
      </div>

      <div className="mt-10 flex items-center justify-center gap-4">
        <button
          onClick={onBack}
          className="text-sm text-text-secondary transition-colors hover:text-text-primary"
        >
          &larr; Back
        </button>
        <button
          onClick={integration ? onNext : onSkip}
          className="rounded-lg bg-primary px-8 py-2.5 font-display text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
        >
          Finish
        </button>
      </div>
    </div>
  );
}
