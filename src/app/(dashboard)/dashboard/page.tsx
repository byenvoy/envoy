import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  profiles,
  conversations,
  drafts,
  usageLogs,
  knowledgeBasePages,
} from "@/lib/db/schema";
import { eq, and, gte, desc, sql } from "drizzle-orm";
import { WelcomeBanner } from "@/components/dashboard/welcome-banner";
import { StatusBadge } from "@/components/inbox/status-badge";
import { canAccessPage, type Role } from "@/lib/permissions";
import type { Conversation } from "@/lib/types/database";

function getThirtyDaysAgo(): string {
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
}

function getMonthStart(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const profile = await db
    .select({ orgId: profiles.orgId, role: profiles.role })
    .from(profiles)
    .where(eq(profiles.id, session.user.id))
    .then((r) => r[0]);

  if (!profile) redirect("/onboarding");
  if (!canAccessPage(profile.role as Role, "/dashboard")) redirect("/inbox");

  const orgId = profile.orgId;
  const thirtyDaysAgo = getThirtyDaysAgo();
  const monthStart = getMonthStart();

  // Fetch all stats in parallel
  const [openCount, recentDrafts, usageLogRows, recentConvoRows, kbPageCount] =
    await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(conversations)
        .where(
          and(eq(conversations.orgId, orgId), eq(conversations.status, "open"))
        )
        .then((r) => Number(r[0]?.count ?? 0)),
      db
        .select({
          status: drafts.status,
          approvedAt: drafts.approvedAt,
          createdAt: drafts.createdAt,
        })
        .from(drafts)
        .where(
          and(
            eq(drafts.orgId, orgId),
            gte(drafts.createdAt, new Date(thirtyDaysAgo))
          )
        ),
      db
        .select({
          estimatedCostUsd: usageLogs.estimatedCostUsd,
          callType: usageLogs.callType,
        })
        .from(usageLogs)
        .where(
          and(
            eq(usageLogs.orgId, orgId),
            gte(usageLogs.createdAt, new Date(monthStart))
          )
        ),
      db
        .select()
        .from(conversations)
        .where(eq(conversations.orgId, orgId))
        .orderBy(desc(conversations.lastMessageAt))
        .limit(10),
      db
        .select({ count: sql<number>`count(*)` })
        .from(knowledgeBasePages)
        .where(
          and(
            eq(knowledgeBasePages.orgId, orgId),
            eq(knowledgeBasePages.isActive, true)
          )
        )
        .then((r) => Number(r[0]?.count ?? 0)),
    ]);

  const drafts30d = recentDrafts ?? [];
  const approvalRate =
    drafts30d.length > 0
      ? Math.round(
          (drafts30d.filter((d) => d.status === "approved").length /
            drafts30d.length) *
            100
        )
      : 0;

  const monthLogs = usageLogRows ?? [];
  const costThisMonth = monthLogs.reduce(
    (sum, l) => sum + Number(l.estimatedCostUsd),
    0
  );
  const draftsThisMonth = monthLogs.filter(
    (l) => l.callType === "draft"
  ).length;

  // Map conversations to snake_case for component compatibility
  const recentConversations = recentConvoRows.map((c) => ({
    id: c.id,
    org_id: c.orgId,
    subject: c.subject,
    status: c.status,
    customer_email: c.customerEmail,
    customer_name: c.customerName,
    autopilot_disabled: c.autopilotDisabled,
    created_at: c.createdAt.toISOString(),
    updated_at: c.updatedAt.toISOString(),
    last_message_at: c.lastMessageAt.toISOString(),
  })) as Conversation[];

  const stats = [
    { label: "Open Conversations", value: openCount ?? 0 },
    { label: "Approval Rate (30d)", value: `${approvalRate}%` },
    { label: "Cost This Month", value: `$${costThisMonth.toFixed(2)}` },
    { label: "Drafts This Month", value: draftsThisMonth },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Overview of your support metrics.
        </p>
      </div>

      <WelcomeBanner />

      {(kbPageCount ?? 0) === 0 && (
        <div className="mb-8 rounded-lg border border-ai-accent bg-ai-accent-light p-4">
          <p className="text-sm text-text-primary">
            Your knowledge base is empty. Add content so Envoy can start
            drafting replies.{" "}
            <Link
              href="/knowledge-base"
              className="font-medium text-primary underline hover:no-underline"
            >
              Go to Knowledge Base
            </Link>
          </p>
        </div>
      )}

      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-border bg-surface-alt p-4"
          >
            <p className="font-display text-xs font-medium text-text-secondary">
              {stat.label}
            </p>
            <p className="mt-1 font-display text-2xl font-bold text-text-primary">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <div>
        <h2 className="mb-4 font-display text-lg font-semibold text-text-primary">
          Recent Conversations
        </h2>
        {recentConversations.length === 0 ? (
          <p className="text-sm text-text-secondary">
            No conversations yet.
          </p>
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border bg-surface-alt">
            {recentConversations.map((convo) => (
              <Link
                key={convo.id}
                href={`/inbox?id=${convo.id}`}
                className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-surface"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-sm font-semibold text-text-primary">
                    {convo.subject || "(No subject)"}
                  </p>
                  <p className="truncate text-xs text-text-secondary">
                    {convo.customer_name || convo.customer_email}
                  </p>
                </div>
                <div className="ml-4 flex items-center gap-3">
                  <StatusBadge status={convo.status} />
                  <span className="font-mono text-xs text-text-secondary">
                    {new Date(convo.last_message_at).toLocaleDateString()}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
