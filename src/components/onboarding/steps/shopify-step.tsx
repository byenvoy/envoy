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
      <h2 className="mb-2 text-xl font-semibold font-display tracking-tight text-text-primary">
        Integrations
      </h2>
      <p className="mb-6 text-sm text-text-secondary">
        Connect your Shopify store to enrich draft replies with customer order
        history, shipping status, and more.
      </p>

      <div className="rounded-lg border border-border bg-surface-alt p-6">
        <ShopifyConnection
          integration={integration}
          hasShopifyClientId={hasShopifyClientId}
        />
      </div>

      <p className="mt-3 text-sm text-text-secondary">
        Need help connecting?{" "}
        <a
          href="#"
          className="font-medium text-text-primary hover:underline"
        >
          View setup instructions
        </a>
      </p>

      <div className="mt-6 flex items-center justify-between">
        <button
          onClick={onBack}
          className="text-sm text-text-secondary transition-colors hover:text-text-primary"
        >
          &larr; Back
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={onSkip}
            className="rounded-lg border border-border px-6 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface"
          >
            Skip
          </button>
          {integration && (
            <button
              onClick={onNext}
              className="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark"
            >
              Continue
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
