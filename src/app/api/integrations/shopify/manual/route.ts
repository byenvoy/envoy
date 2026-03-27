import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { integrations } from "@/lib/db/schema";
import { withAuth } from "@/lib/db/helpers";
import { encrypt } from "@/lib/email/encryption";
import { ShopifyClient } from "@/lib/integrations/shopify-client";

export async function POST(request: Request) {
  const auth = await withAuth();
  if (!auth.success) return auth.response;
  const { orgId } = auth.context;

  const { shop_domain, access_token } = await request.json();

  if (!shop_domain || !access_token) {
    return NextResponse.json(
      { error: "shop_domain and access_token are required" },
      { status: 400 }
    );
  }

  // Validate the token by making a test query
  const client = new ShopifyClient(shop_domain, access_token);
  let shopName: string;
  try {
    const shop = await client.getShop();
    shopName = shop.name;
  } catch {
    return NextResponse.json(
      { error: "Invalid credentials. Could not connect to Shopify store." },
      { status: 400 }
    );
  }

  const accessTokenEncrypted = encrypt(access_token);

  try {
    await db
      .insert(integrations)
      .values({
        orgId,
        provider: "shopify",
        accessTokenEncrypted,
        config: { shop_domain },
        isActive: true,
      })
      .onConflictDoUpdate({
        target: [integrations.orgId, integrations.provider],
        set: {
          accessTokenEncrypted,
          config: { shop_domain },
          isActive: true,
          updatedAt: new Date(),
        },
      });
  } catch (error) {
    console.error("Failed to save Shopify integration:", error);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, shop_name: shopName });
}
