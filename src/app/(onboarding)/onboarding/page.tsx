import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  profiles,
  organizations,
  emailConnections,
  integrations,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { SUPPORTED_MODELS } from "@/lib/rag/llm";
import { getOrgApiKeyStatus } from "@/lib/api-keys";
import { isCloud } from "@/lib/config";
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
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const profile = await db
    .select({ orgId: profiles.orgId, role: profiles.role })
    .from(profiles)
    .where(eq(profiles.id, session.user.id))
    .then((r) => r[0]);

  if (!profile) redirect("/login");

  const [orgRow, connectionRows, integrationRows] = await Promise.all([
    db
      .select({
        preferredModel: organizations.preferredModel,
        onboardingStep: organizations.onboardingStep,
        onboardingCompletedAt: organizations.onboardingCompletedAt,
      })
      .from(organizations)
      .where(eq(organizations.id, profile.orgId))
      .then((r) => r[0]),
    db
      .select()
      .from(emailConnections)
      .where(eq(emailConnections.orgId, profile.orgId)),
    db
      .select()
      .from(integrations)
      .where(eq(integrations.orgId, profile.orgId)),
  ]);

  const orgData = orgRow
    ? ({
        preferred_model: orgRow.preferredModel,
        onboarding_step: orgRow.onboardingStep,
        onboarding_completed_at: orgRow.onboardingCompletedAt?.toISOString() ?? null,
      } as Pick<Organization, "preferred_model" | "onboarding_step" | "onboarding_completed_at">)
    : null;

  // Build model availability
  const orgKeyStatus = await getOrgApiKeyStatus(profile.orgId);
  const uniqueProviders = getUniqueProviders();

  const keyAvailability = new Set<string>();
  for (const [providerKey] of uniqueProviders) {
    if (orgKeyStatus.has(providerKey)) {
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

  // Map connections to snake_case
  const connectionsSnake = connectionRows.map((c) => ({
    id: c.id,
    org_id: c.orgId,
    provider: c.provider,
    email_address: c.emailAddress,
    display_name: c.displayName,
    access_token_encrypted: c.accessTokenEncrypted,
    refresh_token_encrypted: c.refreshTokenEncrypted,
    token_expires_at: c.tokenExpiresAt?.toISOString() ?? "",
    imap_host: c.imapHost,
    imap_port: c.imapPort,
    smtp_host: c.smtpHost,
    smtp_port: c.smtpPort,
    last_polled_at: c.lastPolledAt?.toISOString() ?? null,
    last_uid: c.lastUid,
    status: c.status,
    error_message: c.errorMessage,
    created_at: c.createdAt.toISOString(),
    updated_at: c.updatedAt.toISOString(),
  })) as EmailConnection[];

  // Map integrations to snake_case
  const integrationsSnake = integrationRows.map((i) => ({
    id: i.id,
    org_id: i.orgId,
    provider: i.provider,
    access_token_encrypted: i.accessTokenEncrypted,
    config: i.config,
    is_active: i.isActive,
    created_at: i.createdAt.toISOString(),
    updated_at: i.updatedAt.toISOString(),
  })) as Integration[];

  const shopifyIntegration =
    integrationsSnake.find(
      (i) => i.provider === "shopify" && i.is_active
    ) ?? null;

  return (
    <OnboardingWizard
      initialStep={orgData?.onboarding_step ?? 1}
      currentModel={orgData?.preferred_model ?? "claude-haiku-4-5-20251001"}
      models={models}
      emailConnections={connectionsSnake}
      hasGoogleClientId={!!process.env.GOOGLE_CLIENT_ID}
      hasMicrosoftClientId={!!process.env.MICROSOFT_CLIENT_ID}
      shopifyIntegration={shopifyIntegration}
      hasShopifyClientId={!!process.env.SHOPIFY_CLIENT_ID}
      isCloud={isCloud()}
    />
  );
}
