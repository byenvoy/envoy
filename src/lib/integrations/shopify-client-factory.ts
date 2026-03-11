import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/email/encryption";
import { ShopifyClient } from "./shopify-client";
import type { ShopifyConfig } from "@/lib/types/database";

export async function createShopifyClient(
  orgId: string
): Promise<ShopifyClient | null> {
  const admin = createAdminClient();

  const { data: integration } = await admin
    .from("integrations")
    .select("access_token_encrypted, config")
    .eq("org_id", orgId)
    .eq("provider", "shopify")
    .eq("is_active", true)
    .single();

  if (!integration) return null;

  const config = integration.config as ShopifyConfig;
  const accessToken = decrypt(integration.access_token_encrypted);

  return new ShopifyClient(config.shop_domain, accessToken);
}
