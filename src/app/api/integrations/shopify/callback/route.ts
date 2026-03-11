import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { encrypt } from "@/lib/email/encryption";
import {
  getShopifyTokenUrl,
  getShopifyClientCredentials,
} from "@/lib/integrations/shopify-oauth-config";

function verifyState(signed: string): { orgId: string; shop: string } | null {
  const lastDot = signed.lastIndexOf(".");
  if (lastDot === -1) return null;
  const payload = signed.slice(0, lastDot);
  const sig = signed.slice(lastDot + 1);
  const secret = process.env.ENCRYPTION_KEY!;
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  if (sig !== expected) return null;
  return JSON.parse(Buffer.from(payload, "base64url").toString());
}

function verifyShopifyHmac(
  params: URLSearchParams,
  clientSecret: string
): boolean {
  const hmac = params.get("hmac");
  if (!hmac) return false;

  const entries = Array.from(params.entries())
    .filter(([key]) => key !== "hmac")
    .sort(([a], [b]) => a.localeCompare(b));

  const message = new URLSearchParams(entries).toString();
  const computed = createHmac("sha256", clientSecret)
    .update(message)
    .digest("hex");

  return computed === hmac;
}

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const shop = searchParams.get("shop");

  if (!code || !state || !shop) {
    return NextResponse.redirect(`${appUrl}/settings?error=missing_params`);
  }

  const creds = getShopifyClientCredentials();

  // Verify Shopify's HMAC
  if (!verifyShopifyHmac(searchParams, creds.clientSecret)) {
    return NextResponse.redirect(`${appUrl}/settings?error=invalid_hmac`);
  }

  // Verify our state param
  const stateData = verifyState(state);
  if (!stateData) {
    return NextResponse.redirect(`${appUrl}/settings?error=invalid_state`);
  }

  // Exchange code for access token
  const tokenRes = await fetch(getShopifyTokenUrl(shop), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      code,
    }),
  });

  if (!tokenRes.ok) {
    console.error("Shopify token exchange failed:", await tokenRes.text());
    return NextResponse.redirect(
      `${appUrl}/settings?error=token_exchange_failed`
    );
  }

  const tokenData = await tokenRes.json();
  const accessTokenEncrypted = encrypt(tokenData.access_token);

  const admin = createAdminClient();

  const { error: upsertError } = await admin.from("integrations").upsert(
    {
      org_id: stateData.orgId,
      provider: "shopify",
      access_token_encrypted: accessTokenEncrypted,
      config: { shop_domain: shop },
      is_active: true,
    },
    { onConflict: "org_id,provider" }
  );

  if (upsertError) {
    console.error("Failed to save Shopify integration:", upsertError);
    return NextResponse.redirect(`${appUrl}/settings?error=save_failed`);
  }

  return NextResponse.redirect(`${appUrl}/settings?connected=shopify`);
}
