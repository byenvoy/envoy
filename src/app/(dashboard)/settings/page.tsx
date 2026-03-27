import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  profiles,
  organizations,
  emailConnections,
  integrations,
  teamInvites,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
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
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const profile = await db
    .select({ orgId: profiles.orgId, role: profiles.role })
    .from(profiles)
    .where(eq(profiles.id, session.user.id))
    .then((r) => r[0]);

  if (!profile) redirect("/onboarding");

  const isOwner = profile.role === "owner";

  const [orgRows, connectionRows, integrationRows, teamMemberRows, inviteRows] =
    await Promise.all([
      db
        .select({
          preferredModel: organizations.preferredModel,
          tone: organizations.tone,
          customInstructions: organizations.customInstructions,
        })
        .from(organizations)
        .where(eq(organizations.id, profile.orgId))
        .then((r) => r[0]),
      db.select().from(emailConnections).where(eq(emailConnections.orgId, profile.orgId)),
      db.select().from(integrations).where(eq(integrations.orgId, profile.orgId)),
      db
        .select({ id: profiles.id, fullName: profiles.fullName, role: profiles.role })
        .from(profiles)
        .where(eq(profiles.orgId, profile.orgId)),
      isOwner
        ? db.select().from(teamInvites).where(eq(teamInvites.orgId, profile.orgId))
        : Promise.resolve([]),
    ]);

  // Map Drizzle camelCase results to snake_case for components
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

  const integrationRows_snake = integrationRows.map((i) => ({
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
    integrationRows_snake.find(
      (i) => i.provider === "shopify" && i.is_active
    ) ?? null;

  const orgData = orgRows
    ? ({
        preferred_model: orgRows.preferredModel,
        tone: orgRows.tone,
        custom_instructions: orgRows.customInstructions,
      } as Pick<Organization, "preferred_model" | "tone" | "custom_instructions">)
    : null;

  // Fetch org-level API key status (provider_key -> last 4 chars)
  const orgKeyStatus = await getOrgApiKeyStatus(profile.orgId);

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
    logo: config.logo,
    available: config.envKey ? keyAvailability.has(config.envKey) : false,
    providerKey: config.envKey ?? "",
    providerLabel: config.envKey
      ? (uniqueProviders.get(config.envKey) ?? config.envKey)
      : "",
  }));

  const teamMembersSnake = teamMemberRows.map((m) => ({
    id: m.id,
    full_name: m.fullName,
    role: m.role,
  }));

  const invitesSnake = inviteRows.map((i) => ({
    id: i.id,
    org_id: i.orgId,
    email: i.email,
    role: i.role,
    invited_by: i.invitedBy,
    token: i.token,
    accepted_at: i.acceptedAt?.toISOString() ?? null,
    expires_at: i.expiresAt.toISOString(),
    created_at: i.createdAt.toISOString(),
  })) as TeamInvite[];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-display font-semibold tracking-tight text-text-primary">
          Settings
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Configure your email, AI model, and team.
        </p>
      </div>

      <div className="max-w-lg space-y-6">
        <div className="rounded-lg border border-border bg-surface-alt p-6">
          <h2 className="mb-4 text-lg font-display font-medium text-text-primary">
            Email Address
          </h2>
          <EmailConnectionPicker
            connections={connectionsSnake}
            hasGoogleClientId={!!process.env.GOOGLE_CLIENT_ID}
            hasMicrosoftClientId={!!process.env.MICROSOFT_CLIENT_ID}
          />
        </div>

        <div className="rounded-lg border border-border bg-surface-alt p-6">
          <h2 className="mb-4 text-lg font-display font-medium text-text-primary">
            Integrations
          </h2>
          <ShopifyConnection
            integration={shopifyIntegration}
            hasShopifyClientId={!!process.env.SHOPIFY_CLIENT_ID}
          />
        </div>

        {isOwner && (
          <div className="rounded-lg border border-border bg-surface-alt p-6">
            <h2 className="mb-4 text-lg font-display font-medium text-text-primary">
              API Keys
            </h2>
            <ApiKeySettings providers={apiKeyProviders} />
          </div>
        )}

        {isOwner && (
          <div className="rounded-lg border border-border bg-surface-alt p-6">
            <h2 className="mb-4 text-lg font-display font-medium text-text-primary">
              AI Model
            </h2>
            <ModelSelector
              currentModel={orgData?.preferred_model ?? "claude-haiku-4-5-20251001"}
              models={models}
            />
          </div>
        )}

        {isOwner && (
          <div className="rounded-lg border border-border bg-surface-alt p-6">
            <h2 className="mb-4 text-lg font-display font-medium text-text-primary">
              Response Style
            </h2>
            <ToneSettings
              currentTone={orgData?.tone ?? "professional"}
              currentInstructions={orgData?.custom_instructions ?? null}
            />
          </div>
        )}

        {isOwner && (
          <div className="rounded-lg border border-border bg-surface-alt p-6">
            <h2 className="mb-4 text-lg font-display font-medium text-text-primary">
              Team
            </h2>
            <TeamManagement
              members={teamMembersSnake as { id: string; full_name: string | null; role: string }[]}
              invites={invitesSnake}
              currentUserId={session.user.id}
              appUrl={process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}
            />
          </div>
        )}
      </div>
    </div>
  );
}
