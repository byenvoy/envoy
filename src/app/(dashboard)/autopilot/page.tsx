import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { TopicList } from "@/components/autopilot/topic-list";
import type { Profile, AutopilotTopic } from "@/lib/types/database";

export default async function AutopilotPage() {
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
  if (!isOwner) redirect("/inbox");

  const { data: topics } = await supabase
    .from("autopilot_topics")
    .select("id, name, description, mode, confidence_threshold, daily_send_limit, daily_sends_today, created_at, updated_at")
    .eq("org_id", (profile as Profile & { org_id: string }).org_id)
    .order("created_at", { ascending: true });

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary">
          Autopilot
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Define topics that can be automatically responded to. New topics will
          calibrate before becoming active.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-surface-alt p-6">
        <h2 className="mb-4 text-lg font-display font-medium text-text-primary">
          Topics
        </h2>
        <TopicList initialTopics={(topics as AutopilotTopic[]) ?? []} />
      </div>
    </div>
  );
}
