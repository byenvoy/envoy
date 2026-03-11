const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const SHOPIFY_SCOPES = [
  "read_customers",
  "read_orders",
  "read_fulfillments",
  "read_products",
  "read_returns",
  "read_draft_orders",
  "read_gift_cards",
  "read_discounts",
];

export function getShopifyAuthUrl(shopDomain: string): string {
  return `https://${shopDomain}/admin/oauth/authorize`;
}

export function getShopifyTokenUrl(shopDomain: string): string {
  return `https://${shopDomain}/admin/oauth/access_token`;
}

export function getShopifyRedirectUri(): string {
  return `${appUrl}/api/integrations/shopify/callback`;
}

export function getShopifyClientCredentials(): {
  clientId: string;
  clientSecret: string;
} {
  return {
    clientId: process.env.SHOPIFY_CLIENT_ID!,
    clientSecret: process.env.SHOPIFY_CLIENT_SECRET!,
  };
}
