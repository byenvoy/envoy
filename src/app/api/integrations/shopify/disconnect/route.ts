import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { integrations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/db/helpers";
import { decrypt } from "@/lib/email/encryption";

async function revokeShopifyToken(shopDomain: string, accessToken: string) {
  try {
    await fetch(`https://${shopDomain}/admin/api/2025-01/access_tokens/current.json`, {
      method: "DELETE",
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
    });
  } catch (err) {
    console.error("Failed to revoke Shopify access token:", err);
  }
}

export async function POST() {
  const auth = await withAuth();
  if (!auth.success) return auth.response;
  const { orgId } = auth.context;

  const [existing] = await db
    .select()
    .from(integrations)
    .where(
      and(
        eq(integrations.orgId, orgId),
        eq(integrations.provider, "shopify")
      )
    )
    .limit(1);

  if (existing) {
    const accessToken = decrypt(existing.accessTokenEncrypted);
    const shopDomain = existing.config.shop_domain as string;
    await revokeShopifyToken(shopDomain, accessToken);
  }

  await db
    .delete(integrations)
    .where(
      and(
        eq(integrations.orgId, orgId),
        eq(integrations.provider, "shopify")
      )
    );

  return NextResponse.json({ ok: true });
}
