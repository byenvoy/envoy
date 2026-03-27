import { db } from "@/lib/db";
import { emailConnections } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { decryptTokens, encryptTokens } from "./encryption";
import { OAUTH_PROVIDERS, getClientCredentials } from "./oauth-config";
import type { EmailConnection } from "@/lib/types/database";

export async function getValidTokens(
  connection: EmailConnection
): Promise<{ access_token: string; refresh_token: string }> {
  const tokens = decryptTokens({
    access_token_encrypted: connection.access_token_encrypted,
    refresh_token_encrypted: connection.refresh_token_encrypted,
  });

  // Refresh if within 5 minutes of expiry
  const expiresAt = new Date(connection.token_expires_at).getTime();
  const buffer = 5 * 60 * 1000;
  if (Date.now() < expiresAt - buffer) {
    return tokens;
  }

  const provider = connection.provider;
  const config = OAUTH_PROVIDERS[provider];
  const creds = getClientCredentials(provider);

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: tokens.refresh_token,
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
  });

  const res = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Token refresh failed: ${error}`);
  }

  const data = await res.json();
  const newTokens = {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? tokens.refresh_token,
  };

  const encrypted = encryptTokens(newTokens);
  await db
    .update(emailConnections)
    .set({
      accessTokenEncrypted: encrypted.access_token_encrypted,
      refreshTokenEncrypted: encrypted.refresh_token_encrypted,
      tokenExpiresAt: new Date(
        Date.now() + (data.expires_in ?? 3600) * 1000
      ),
    })
    .where(eq(emailConnections.id, connection.id));

  return newTokens;
}
