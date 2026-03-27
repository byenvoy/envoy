import { db } from "@/lib/db";
import { integrations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { decrypt } from "@/lib/email/encryption";
import { ShopifyClient } from "./shopify-client";
import type { ShopifyConfig } from "@/lib/types/database";

export async function createShopifyClient(
  orgId: string
): Promise<ShopifyClient | null> {
  const integration = await db
    .select({
      accessTokenEncrypted: integrations.accessTokenEncrypted,
      config: integrations.config,
    })
    .from(integrations)
    .where(
      and(
        eq(integrations.orgId, orgId),
        eq(integrations.provider, "shopify"),
        eq(integrations.isActive, true)
      )
    )
    .then((r) => r[0]);

  if (!integration) return null;

  const config = integration.config as ShopifyConfig;
  const accessToken = decrypt(integration.accessTokenEncrypted);

  return new ShopifyClient(config.shop_domain, accessToken);
}
