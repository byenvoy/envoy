import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { EmailConnectionPicker } from "@/components/settings/email-connection-picker";
import { ShopifyConnection } from "@/components/settings/shopify-connection";
import { ModelSelector } from "@/components/settings/model-selector";
import { ToneSettings } from "@/components/settings/tone-settings";
import { TeamManagement } from "@/components/settings/team-management";
import { ApiKeySettings } from "@/components/settings/api-key-settings";
import { SUPPORTED_MODELS } from "@/lib/rag/llm";
import { hasEnvKey, getOrgApiKeyStatus } from "@/lib/api-keys";
import type { EmailConnection, Integration, Organization, Profile, TeamInvite } from "@/lib/types/database";

/** Derive unique provider entries from SUPPORTED_MODELS for the API key UI. */
function getUniqueProviders() {
  const seen = new Map<string, string>();
  for (const config of Object.values(SUPPORTED_MODELS)) {
    if (config.envKey && !seen.has(config.envKey)) {
      // Derive a human label from the envKey: "ANTHROPIC_API_KEY" -> "Anthropic"
      const label = config.envKey
        .replace(/_API_KEY$/, "")
        .split("_")
        .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
        .join(" ");
      seen.set(config.envKey, label);
    }
  }
  return seen;
}

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id, role")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/onboarding");

  const isOwner = (profile as Profile).role === "owner";

  const [
    { data: org },
    { data: emailAddress },
    { data: connections },
    { data: integrations },
    { data: teamMembers },
    { data: invites },
  ] = await Promise.all([
    supabase
      .from("organizations")
      .select("preferred_model, tone, custom_instructions")
      .eq("id", profile.org_id)
      .single(),
    supabase
      .from("email_addresses")
      .select("*")
      .eq("org_id", profile.org_id)
      .eq("is_active", true)
      .limit(1)
      .single(),
    supabase
      .from("email_connections")
      .select("*")
      .eq("org_id", profile.org_id),
    supabase
      .from("integrations")
      .select("*")
      .eq("org_id", profile.org_id),
    supabase
      .from("profiles")
      .select("id, full_name, role")
      .eq("org_id", profile.org_id),
    isOwner
      ? supabase
          .from("team_invites")
          .select("*")
          .eq("org_id", profile.org_id)
      : Promise.resolve({ data: [] }),
  ]);

  const shopifyIntegration =
    ((integrations ?? []) as Integration[]).find(
      (i) => i.provider === "shopify" && i.is_active
    ) ?? null;

  const orgData = org as Organization | null;

  // Fetch org-level API key status (provider_key -> last 4 chars)
  const orgKeyStatus = await getOrgApiKeyStatus(profile.org_id);

  // Build unique provider list for API key UI
  const uniqueProviders = getUniqueProviders();
  const apiKeyProviders = Array.from(uniqueProviders.entries()).map(
    ([providerKey, label]) => ({
      providerKey,
      label,
      hasOrgKey: orgKeyStatus.has(providerKey),
      hasEnvKey: hasEnvKey(providerKey),
      lastFour: orgKeyStatus.get(providerKey) ?? null,
    })
  );

  // Build model availability: a model is available if its envKey has an org key or env var
  const keyAvailability = new Set<string>();
  for (const [providerKey] of uniqueProviders) {
    if (orgKeyStatus.has(providerKey) || hasEnvKey(providerKey)) {
      keyAvailability.add(providerKey);
    }
  }

  const models = Object.entries(SUPPORTED_MODELS).map(([id, config]) => ({
    id,
    label: config.label,
    available: config.envKey ? keyAvailability.has(config.envKey) : false,
    providerKey: config.envKey ?? "",
    providerLabel: config.envKey
      ? (uniqueProviders.get(config.envKey) ?? config.envKey)
      : "",
  }));

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Settings
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Configure your email, AI model, and team.
        </p>
      </div>

      <div className="max-w-lg space-y-6">
        <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-800">
          <h2 className="mb-4 text-lg font-medium text-zinc-900 dark:text-zinc-50">
            Email Address
          </h2>
          <EmailConnectionPicker
            emailAddress={emailAddress}
            connections={(connections ?? []) as EmailConnection[]}
            hasGoogleClientId={!!process.env.GOOGLE_CLIENT_ID}
            hasMicrosoftClientId={!!process.env.MICROSOFT_CLIENT_ID}
          />
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-800">
          <h2 className="mb-4 text-lg font-medium text-zinc-900 dark:text-zinc-50">
            Integrations
          </h2>
          <ShopifyConnection
            integration={shopifyIntegration}
            hasShopifyClientId={!!process.env.SHOPIFY_CLIENT_ID}
          />
        </div>

        {isOwner && (
          <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-800">
            <h2 className="mb-4 text-lg font-medium text-zinc-900 dark:text-zinc-50">
              API Keys
            </h2>
            <ApiKeySettings providers={apiKeyProviders} />
          </div>
        )}

        {isOwner && (
          <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-800">
            <h2 className="mb-4 text-lg font-medium text-zinc-900 dark:text-zinc-50">
              AI Model
            </h2>
            <ModelSelector
              currentModel={orgData?.preferred_model ?? "claude-haiku-4-5-20251001"}
              models={models}
            />
          </div>
        )}

        {isOwner && (
          <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-800">
            <h2 className="mb-4 text-lg font-medium text-zinc-900 dark:text-zinc-50">
              Response Style
            </h2>
            <ToneSettings
              currentTone={orgData?.tone ?? "professional"}
              currentInstructions={orgData?.custom_instructions ?? null}
            />
          </div>
        )}

        {isOwner && (
          <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-800">
            <h2 className="mb-4 text-lg font-medium text-zinc-900 dark:text-zinc-50">
              Team
            </h2>
            <TeamManagement
              members={(teamMembers ?? []) as { id: string; full_name: string | null; role: string }[]}
              invites={(invites ?? []) as TeamInvite[]}
              currentUserId={user.id}
              appUrl={process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}
            />
          </div>
        )}
      </div>
    </div>
  );
}
