import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encrypt } from "@/lib/email/encryption";
import { ShopifyClient } from "@/lib/integrations/shopify-client";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

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

  const admin = createAdminClient();
  const { error } = await admin.from("integrations").upsert(
    {
      org_id: profile.org_id,
      provider: "shopify",
      access_token_encrypted: accessTokenEncrypted,
      config: { shop_domain },
      is_active: true,
    },
    { onConflict: "org_id,provider" }
  );

  if (error) {
    console.error("Failed to save Shopify integration:", error);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, shop_name: shopName });
}
