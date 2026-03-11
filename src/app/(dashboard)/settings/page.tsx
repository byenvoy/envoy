import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { EmailConnectionPicker } from "@/components/settings/email-connection-picker";
import { ShopifyConnection } from "@/components/settings/shopify-connection";
import type { EmailConnection, Integration } from "@/lib/types/database";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/onboarding");

  const [{ data: emailAddress }, { data: connections }, { data: integrations }] =
    await Promise.all([
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
    ]);

  const shopifyIntegration =
    ((integrations ?? []) as Integration[]).find(
      (i) => i.provider === "shopify" && i.is_active
    ) ?? null;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Settings
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Configure your email and integrations.
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
      </div>
    </div>
  );
}
