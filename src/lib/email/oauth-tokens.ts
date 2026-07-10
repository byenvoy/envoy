import { db } from "@/lib/db";
import { emailConnections } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { decryptTokens, encryptTokens } from "./encryption";
import { OAUTH_PROVIDERS, getClientCredentials } from "./oauth-config";
type EmailConnectionRow = typeof emailConnections.$inferSelect;

/**
 * Thrown when the OAuth provider rejects the refresh token as permanently
 * invalid (e.g. Google `invalid_grant`: user revoked access, token expired,
 * or the OAuth app is still in Testing mode where refresh tokens die after
 * 7 days). These never self-recover — the connection must be reconnected — so
 * the poller marks it `revoked` and stops retrying rather than logging the
 * same failure every cycle.
 */
export class TokenRevokedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TokenRevokedError";
  }
}

// Provider responses that mean "reconnect required", not "retry later".
const FATAL_OAUTH_ERROR = /invalid_grant|invalid_client|unauthorized_client|invalid_scope/i;

export async function getValidTokens(
  connection: EmailConnectionRow
): Promise<{ access_token: string; refresh_token: string }> {
  const tokens = decryptTokens({
    access_token_encrypted: connection.accessTokenEncrypted,
    refresh_token_encrypted: connection.refreshTokenEncrypted,
  });

  // Refresh if within 5 minutes of expiry
  const expiresAt = new Date(connection.tokenExpiresAt).getTime();
  const buffer = 5 * 60 * 1000;
  if (Date.now() < expiresAt - buffer) {
    return tokens;
  }

  const provider = connection.provider as "google" | "microsoft";
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
    const message = `Token refresh failed: ${error}`;
    if (FATAL_OAUTH_ERROR.test(error)) {
      throw new TokenRevokedError(message);
    }
    throw new Error(message);
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
