import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createHmac } from "crypto";
import {
  SHOPIFY_SCOPES,
  getShopifyAuthUrl,
  getShopifyRedirectUri,
  getShopifyClientCredentials,
} from "@/lib/integrations/shopify-oauth-config";

function signState(payload: string): string {
  const secret = process.env.ENCRYPTION_KEY!;
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  const { searchParams } = new URL(request.url);
  const shop = searchParams.get("shop");

  if (!shop || !/^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(shop)) {
    return NextResponse.json(
      { error: "Invalid shop domain. Must be *.myshopify.com" },
      { status: 400 }
    );
  }

  const creds = getShopifyClientCredentials();
  const statePayload = JSON.stringify({
    orgId: profile.org_id,
    shop,
  });
  const state = signState(Buffer.from(statePayload).toString("base64url"));

  const params = new URLSearchParams({
    client_id: creds.clientId,
    scope: SHOPIFY_SCOPES.join(","),
    redirect_uri: getShopifyRedirectUri(),
    state,
  });

  return NextResponse.redirect(
    `${getShopifyAuthUrl(shop)}?${params.toString()}`
  );
}
