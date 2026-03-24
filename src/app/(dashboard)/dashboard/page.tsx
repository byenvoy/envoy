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
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Overview of your support metrics.
        </p>
      </div>

      <WelcomeBanner />

      {(kbPageCount ?? 0) === 0 && (
        <div className="mb-8 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Your knowledge base is empty. Add content so Envoyer can start
            drafting replies.{" "}
            <Link
              href="/knowledge-base"
              className="font-medium underline hover:no-underline"
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
            className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {stat.label}
            </p>
            <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <div>
        <h2 className="mb-4 text-lg font-medium text-zinc-900 dark:text-zinc-50">
          Recent Tickets
        </h2>
        {tickets.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No tickets yet.
          </p>
        ) : (
          <div className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
            {tickets.map((ticket) => (
              <Link
                key={ticket.id}
                href={`/inbox/${ticket.id}`}
                className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {ticket.subject || "(No subject)"}
                  </p>
                  <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                    {ticket.from_name || ticket.from_email}
                  </p>
                </div>
                <div className="ml-4 flex items-center gap-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      ticket.status === "new"
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                        : ticket.status === "draft_generated"
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                          : ticket.status === "sent"
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}
                  >
                    {ticket.status.replace("_", " ")}
                  </span>
                  <span className="text-xs text-zinc-400 dark:text-zinc-500">
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
