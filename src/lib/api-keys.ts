import { createAdminClient } from "@/lib/supabase/admin";
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
  const admin = createAdminClient();
  const { data } = await admin
    .from("org_api_keys")
    .select("api_key_encrypted")
    .eq("org_id", orgId)
    .eq("provider_key", providerKey)
    .single();

  if (data?.api_key_encrypted) {
    try {
      return decrypt(data.api_key_encrypted);
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
  const admin = createAdminClient();
  const { data } = await admin
    .from("org_api_keys")
    .select("provider_key, api_key_encrypted")
    .eq("org_id", orgId);

  const result = new Map<string, string>();
  for (const row of data ?? []) {
    try {
      const decrypted = decrypt(row.api_key_encrypted);
      result.set(row.provider_key, decrypted.slice(-4));
    } catch {
      result.set(row.provider_key, "****");
    }
  }
  return result;
}
