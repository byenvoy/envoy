import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { SUPPORTED_MODELS } from "@/lib/rag/llm";
import { hasEnvKey, getOrgApiKeyStatus } from "@/lib/api-keys";
import type {
  EmailConnection,
  Integration,
  Organization,
} from "@/lib/types/database";

function getUniqueProviders() {
  const seen = new Map<string, string>();
  for (const config of Object.values(SUPPORTED_MODELS)) {
    if (config.envKey && !seen.has(config.envKey)) {
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

export default async function OnboardingPage() {
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

  if (!profile) redirect("/login");

  const [
    { data: org },
    { data: connections },
    { data: integrations },
  ] = await Promise.all([
    supabase
      .from("organizations")
      .select("preferred_model, onboarding_step, onboarding_completed_at")
      .eq("id", profile.org_id)
      .single(),
    supabase
      .from("email_connections")
      .select("*")
      .eq("org_id", profile.org_id),
    supabase
      .from("integrations")
      .select("*")
      .eq("org_id", profile.org_id),
  ]);

  const orgData = org as Organization | null;

  // Build model availability
  const orgKeyStatus = await getOrgApiKeyStatus(profile.org_id);
  const uniqueProviders = getUniqueProviders();

  const keyAvailability = new Set<string>();
  for (const [providerKey] of uniqueProviders) {
    if (orgKeyStatus.has(providerKey) || hasEnvKey(providerKey)) {
      keyAvailability.add(providerKey);
    }
  }

  const models = Object.entries(SUPPORTED_MODELS).map(([id, config]) => ({
    id,
    label: config.label,
    logo: config.logo,
    available: config.envKey ? keyAvailability.has(config.envKey) : false,
    providerKey: config.envKey ?? "",
    providerLabel: config.envKey
      ? (uniqueProviders.get(config.envKey) ?? config.envKey)
      : "",
  }));

  const shopifyIntegration =
    ((integrations ?? []) as Integration[]).find(
      (i) => i.provider === "shopify" && i.is_active
    ) ?? null;

  return (
    <OnboardingWizard
      initialStep={orgData?.onboarding_step ?? 1}
      currentModel={orgData?.preferred_model ?? "claude-haiku-4-5-20251001"}
      models={models}
      emailConnections={(connections ?? []) as EmailConnection[]}
      hasGoogleClientId={!!process.env.GOOGLE_CLIENT_ID}
      hasMicrosoftClientId={!!process.env.MICROSOFT_CLIENT_ID}
      shopifyIntegration={shopifyIntegration}
      hasShopifyClientId={!!process.env.SHOPIFY_CLIENT_ID}
    />
  );
}
