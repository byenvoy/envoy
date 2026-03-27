import { db } from "@/lib/db";
import { orgApiKeys } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { decrypt } from "@/lib/email/encryption";

/**
 * Get an API key for a provider, checking org-level keys first, then env var fallback.
 * @param orgId - Organization ID
 * @param providerKey - The env var name / provider key (e.g. "ANTHROPIC_API_KEY", "MISTRAL_API_KEY")
 */
export async function getOrgApiKey(
  orgId: string,
  providerKey: string
): Promise<string | null> {
  const row = await db
    .select({ apiKeyEncrypted: orgApiKeys.apiKeyEncrypted })
    .from(orgApiKeys)
    .where(
      and(
        eq(orgApiKeys.orgId, orgId),
        eq(orgApiKeys.providerKey, providerKey)
      )
    )
    .then((r) => r[0]);

  if (row?.apiKeyEncrypted) {
    try {
      return decrypt(row.apiKeyEncrypted);
    } catch {
      console.error(`Failed to decrypt ${providerKey} API key for org ${orgId}`);
    }
  }

  // Fall back to env var
  return process.env[providerKey] ?? null;
}

/**
 * Check if a server-level env var exists for a provider key.
 */
export function hasEnvKey(providerKey: string): boolean {
  return !!process.env[providerKey];
}

/**
 * Get all org-level API keys (provider_key only, no secrets) for an org.
 */
export async function getOrgApiKeyStatus(
  orgId: string
): Promise<Map<string, string>> {
  const rows = await db
    .select({
      providerKey: orgApiKeys.providerKey,
      apiKeyEncrypted: orgApiKeys.apiKeyEncrypted,
    })
    .from(orgApiKeys)
    .where(eq(orgApiKeys.orgId, orgId));

  const result = new Map<string, string>();
  for (const row of rows) {
    try {
      const decrypted = decrypt(row.apiKeyEncrypted);
      result.set(row.providerKey, decrypted.slice(-4));
    } catch {
      result.set(row.providerKey, "****");
    }
  }
  return result;
}
