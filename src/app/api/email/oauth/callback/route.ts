import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  OAUTH_PROVIDERS,
  getClientCredentials,
  getRedirectUri,
} from "@/lib/email/oauth-config";
import { encryptTokens } from "@/lib/email/encryption";

function verifyState(signed: string): { orgId: string; provider: "google" | "microsoft" } | null {
  const lastDot = signed.lastIndexOf(".");
  if (lastDot === -1) return null;
  const payload = signed.slice(0, lastDot);
  const sig = signed.slice(lastDot + 1);
  const secret = process.env.ENCRYPTION_KEY!;
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  if (sig !== expected) return null;
  return JSON.parse(Buffer.from(payload, "base64url").toString());
}

function decodeIdToken(idToken: string): { email: string; name?: string } {
  const payload = idToken.split(".")[1];
  const decoded = JSON.parse(Buffer.from(payload, "base64url").toString());
  return { email: decoded.email, name: decoded.name };
}

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      `${appUrl}/settings?error=${encodeURIComponent(error)}`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(`${appUrl}/settings?error=missing_params`);
  }

  const stateData = verifyState(state);
  if (!stateData) {
    return NextResponse.redirect(`${appUrl}/settings?error=invalid_state`);
  }

  const { orgId, provider } = stateData;
  const config = OAUTH_PROVIDERS[provider];
  const creds = getClientCredentials(provider);

  // Exchange code for tokens
  const tokenBody = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: getRedirectUri(),
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
  });

  const tokenRes = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenBody.toString(),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    console.error("Token exchange failed:", err);
    return NextResponse.redirect(
      `${appUrl}/settings?error=token_exchange_failed`
    );
  }

  const tokenData = await tokenRes.json();
  const { email, name } = decodeIdToken(tokenData.id_token);

  const encrypted = encryptTokens({
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
  });

  const admin = createAdminClient();

  // Upsert email_connections
  const { error: connError } = await admin
    .from("email_connections")
    .upsert(
      {
        org_id: orgId,
        provider,
        email_address: email,
        display_name: name ?? null,
        access_token_encrypted: encrypted.access_token_encrypted,
        refresh_token_encrypted: encrypted.refresh_token_encrypted,
        token_expires_at: new Date(
          Date.now() + (tokenData.expires_in ?? 3600) * 1000
        ).toISOString(),
        imap_host: config.imapHost,
        imap_port: config.imapPort,
        smtp_host: config.smtpHost,
        smtp_port: config.smtpPort,
        status: "active",
        error_message: null,
      },
      { onConflict: "org_id,provider" }
    );

  if (connError) {
    console.error("Failed to save connection:", connError);
    return NextResponse.redirect(
      `${appUrl}/settings?error=save_failed`
    );
  }

  // Upsert email_addresses with connection_type = 'oauth'
  const { data: existingAddr } = await admin
    .from("email_addresses")
    .select("id")
    .eq("org_id", orgId)
    .eq("email_address", email)
    .single();

  if (existingAddr) {
    await admin
      .from("email_addresses")
      .update({ display_name: name ?? null, is_active: true, connection_type: "oauth" })
      .eq("id", existingAddr.id);
  } else {
    await admin.from("email_addresses").insert({
      org_id: orgId,
      email_address: email,
      display_name: name ?? null,
      is_active: true,
      connection_type: "oauth",
    });
  }

  return NextResponse.redirect(
    `${appUrl}/settings?connected=${provider}`
  );
}
