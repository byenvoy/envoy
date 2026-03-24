import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { WelcomeBanner } from "@/components/dashboard/welcome-banner";
import type { Ticket } from "@/lib/types/database";

function getThirtyDaysAgo(): string {
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
}

function getMonthStart(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

export default async function DashboardPage() {
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

  const orgId = profile.org_id;
  const thirtyDaysAgo = getThirtyDaysAgo();
  const monthStart = getMonthStart();

  // Fetch all stats in parallel
  const [
    { count: openCount },
    { count: needingResponseCount },
    { data: recentDrafts },
    { data: usageLogs },
    { data: recentTickets },
    { count: kbPageCount },
  ] = await Promise.all([
    supabase
      .from("tickets")
      .select("*", { count: "exact", head: true })
      .eq("org_id", orgId)
      .in("status", ["new", "draft_generated"]),
    supabase
      .from("tickets")
      .select("*", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("status", "new"),
    supabase
      .from("draft_replies")
      .select("was_approved, approved_at, created_at")
      .eq("org_id", orgId)
      .gte("created_at", thirtyDaysAgo),
    supabase
      .from("usage_logs")
      .select("estimated_cost_usd, call_type")
      .eq("org_id", orgId)
      .gte("created_at", monthStart),
    supabase
      .from("tickets")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("knowledge_base_pages")
      .select("*", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("is_active", true),
  ]);

  const drafts30d = recentDrafts ?? [];
  const approvalRate =
    drafts30d.length > 0
      ? Math.round(
          (drafts30d.filter((d) => d.was_approved === true).length /
            drafts30d.length) *
            100
        )
      : 0;

  const monthLogs = usageLogs ?? [];
  const costThisMonth = monthLogs.reduce(
    (sum, l) => sum + Number(l.estimated_cost_usd),
    0
  );
  const draftsThisMonth = monthLogs.filter(
    (l) => l.call_type === "draft"
  ).length;

  const tickets = (recentTickets ?? []) as Ticket[];

  const stats = [
    { label: "Open Tickets", value: openCount ?? 0 },
    { label: "Needing Response", value: needingResponseCount ?? 0 },
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
            Your knowledge base is empty. Add content so Envoyer can start
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

      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
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
          Recent Tickets
        </h2>
        {tickets.length === 0 ? (
          <p className="text-sm text-text-secondary">
            No tickets yet.
          </p>
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border bg-surface-alt">
            {tickets.map((ticket) => (
              <Link
                key={ticket.id}
                href={`/inbox/${ticket.id}`}
                className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-surface"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-sm font-semibold text-text-primary">
                    {ticket.subject || "(No subject)"}
                  </p>
                  <p className="truncate text-xs text-text-secondary">
                    {ticket.from_name || ticket.from_email}
                  </p>
                </div>
                <div className="ml-4 flex items-center gap-3">
                  <span
                    className={`rounded-full px-2 py-0.5 font-display text-xs font-semibold ${
                      ticket.status === "new"
                        ? "bg-info-light text-info"
                        : ticket.status === "draft_generated"
                          ? "bg-ai-accent-light text-ai-accent"
                          : ticket.status === "sent"
                            ? "bg-success-light text-primary"
                            : "bg-surface-alt text-text-secondary"
                    }`}
                  >
                    {ticket.status.replace("_", " ")}
                  </span>
                  <span className="font-mono text-xs text-text-secondary">
                    {new Date(ticket.created_at).toLocaleDateString()}
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
