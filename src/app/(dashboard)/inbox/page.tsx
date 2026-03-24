import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { InboxView } from "@/components/inbox/inbox-view";

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string; id?: string }>;
}) {
  const { status: statusFilter, search } = await searchParams;
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

  // Fetch tickets with filters
  let query = supabase
    .from("tickets")
    .select("*")
    .eq("org_id", profile.org_id)
    .order("created_at", { ascending: false });

  if (statusFilter && statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }

  if (search) {
    query = query.or(
      `from_email.ilike.%${search}%,from_name.ilike.%${search}%,subject.ilike.%${search}%`
    );
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

  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center"><p className="text-sm text-text-secondary">Loading inbox...</p></div>}>
      <InboxView tickets={tickets ?? []} statusCounts={counts} />
    </Suspense>
  );
}
