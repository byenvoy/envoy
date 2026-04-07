import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { profiles, autopilotTopics } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { TopicList } from "@/components/autopilot/topic-list";
import { isCloud } from "@/lib/config";
import type { AutopilotTopic } from "@/lib/types/database";

export default async function AutopilotPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const profile = await db
    .select({ orgId: profiles.orgId, role: profiles.role })
    .from(profiles)
    .where(eq(profiles.id, session.user.id))
    .then((r) => r[0]);

  if (!profile) redirect("/onboarding");


  const topicRows = await db
    .select({
      id: autopilotTopics.id,
      name: autopilotTopics.name,
      description: autopilotTopics.description,
      mode: autopilotTopics.mode,
      confidenceThreshold: autopilotTopics.confidenceThreshold,
      dailySendLimit: autopilotTopics.dailySendLimit,
      dailySendsToday: autopilotTopics.dailySendsToday,
      createdAt: autopilotTopics.createdAt,
      updatedAt: autopilotTopics.updatedAt,
    })
    .from(autopilotTopics)
    .where(eq(autopilotTopics.orgId, profile.orgId))
    .orderBy(asc(autopilotTopics.createdAt));

  // Map to snake_case for component compatibility
  const topics = topicRows.map((t) => ({
    id: t.id,
    org_id: profile.orgId,
    name: t.name,
    description: t.description,
    embedding: null,
    mode: t.mode,
    confidence_threshold: Number(t.confidenceThreshold),
    daily_send_limit: t.dailySendLimit,
    daily_sends_today: t.dailySendsToday,
    created_at: t.createdAt.toISOString(),
    updated_at: t.updatedAt.toISOString(),
  })) as AutopilotTopic[];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary">
          Autopilot
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Define topics that can be automatically responded to.{" "}
          {isCloud()
            ? "New topics will calibrate before becoming active."
            : "Enable a topic to start auto-responding."}
        </p>
      </div>

      <div className="rounded-lg border border-border bg-surface-alt p-4 sm:p-6">
        <h2 className="mb-4 text-lg font-display font-medium text-text-primary">
          Topics
        </h2>
        <TopicList initialTopics={topics} isCloud={isCloud()} />
      </div>
    </div>
  );
}
