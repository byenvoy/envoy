import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { TicketList } from "@/components/inbox/ticket-list";
const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "new", label: "New" },
  { value: "draft_generated", label: "Draft Ready" },
  { value: "sent", label: "Sent" },
  { value: "discarded", label: "Discarded" },
];

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: statusFilter } = await searchParams;
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

  // Fetch tickets
  let query = supabase
    .from("tickets")
    .select("*")
    .eq("org_id", profile.org_id)
    .order("created_at", { ascending: false });

  if (statusFilter && statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }

  const { data: tickets } = await query;

  // Get counts per status
  const { data: allTickets } = await supabase
    .from("tickets")
    .select("status")
    .eq("org_id", profile.org_id);

  const counts: Record<string, number> = { all: allTickets?.length ?? 0 };
  for (const t of allTickets ?? []) {
    counts[t.status] = (counts[t.status] ?? 0) + 1;
  }

  const activeFilter = statusFilter || "all";

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Inbox
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Review and respond to customer emails.
        </p>
      </div>

      {/* Status filter tabs */}
      <div className="mb-6 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((filter) => (
          <Link
            key={filter.value}
            href={filter.value === "all" ? "/inbox" : `/inbox?status=${filter.value}`}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              activeFilter === filter.value
                ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
            }`}
          >
            {filter.label}
            {counts[filter.value] ? ` (${counts[filter.value]})` : ""}
          </Link>
        ))}
      </div>

      <TicketList tickets={tickets ?? []} />
    </div>
  );
}
