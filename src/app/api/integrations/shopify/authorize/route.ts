import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { withAuth } from "@/lib/db/helpers";
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
  const auth = await withAuth();
  if (!auth.success) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  const { orgId } = auth.context;

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
    orgId,
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
