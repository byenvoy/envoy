import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { EmailSettingsForm } from "@/components/settings/email-settings-form";

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

  const { data: emailAddress } = await supabase
    .from("email_addresses")
    .select("*")
    .eq("org_id", profile.org_id)
    .eq("is_active", true)
    .limit(1)
    .single();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Settings
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Configure your email integration.
        </p>
      </div>

      <div className="max-w-lg rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-800">
        <h2 className="mb-4 text-lg font-medium text-zinc-900 dark:text-zinc-50">
          Email Address
        </h2>
        <EmailSettingsForm emailAddress={emailAddress} />
      </div>
    </div>
  );
}
