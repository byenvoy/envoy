import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { db } from "@/lib/db";
import { emailConnections, emailAddresses } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
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

  // Upsert email_connections
  try {
    await db
      .insert(emailConnections)
      .values({
        orgId,
        provider,
        emailAddress: email,
        displayName: name ?? null,
        accessTokenEncrypted: encrypted.access_token_encrypted,
        refreshTokenEncrypted: encrypted.refresh_token_encrypted,
        tokenExpiresAt: new Date(
          Date.now() + (tokenData.expires_in ?? 3600) * 1000
        ),
        imapHost: config.imapHost,
        imapPort: config.imapPort,
        smtpHost: config.smtpHost,
        smtpPort: config.smtpPort,
        status: "active",
        errorMessage: null,
      })
      .onConflictDoUpdate({
        target: [emailConnections.orgId, emailConnections.provider],
        set: {
          emailAddress: email,
          displayName: name ?? null,
          accessTokenEncrypted: encrypted.access_token_encrypted,
          refreshTokenEncrypted: encrypted.refresh_token_encrypted,
          tokenExpiresAt: new Date(
            Date.now() + (tokenData.expires_in ?? 3600) * 1000
          ),
          imapHost: config.imapHost,
          imapPort: config.imapPort,
          smtpHost: config.smtpHost,
          smtpPort: config.smtpPort,
          status: "active",
          errorMessage: null,
          updatedAt: new Date(),
        },
      });
  } catch (connError) {
    console.error("Failed to save connection:", connError);
    return NextResponse.redirect(
      `${appUrl}/settings?error=save_failed`
    );
  }

  // Upsert email_addresses with connection_type = 'oauth'
  const existingAddr = await db
    .select({ id: emailAddresses.id })
    .from(emailAddresses)
    .where(
      and(
        eq(emailAddresses.orgId, orgId),
        eq(emailAddresses.emailAddress, email)
      )
    )
    .then((r) => r[0]);

  if (existingAddr) {
    await db
      .update(emailAddresses)
      .set({ displayName: name ?? null, isActive: true, connectionType: "oauth" })
      .where(eq(emailAddresses.id, existingAddr.id));
  } else {
    await db.insert(emailAddresses).values({
      orgId,
      emailAddress: email,
      displayName: name ?? null,
      isActive: true,
      connectionType: "oauth",
    });
  }

  return NextResponse.redirect(
    `${appUrl}/settings?connected=${provider}`
  );
}
