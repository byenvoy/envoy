import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { InboxView } from "@/components/inbox/inbox-view";
import type { ConversationStatus } from "@/lib/types/database";

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

  // Fetch conversations with filters
  let query = supabase
    .from("conversations")
    .select("*")
    .eq("org_id", profile.org_id)
    .order("updated_at", { ascending: false });

  if (statusFilter && statusFilter !== "all") {
    query = query.eq("status", statusFilter as ConversationStatus);
  }

  if (search) {
    query = query.or(
      `customer_email.ilike.%${search}%,customer_name.ilike.%${search}%,subject.ilike.%${search}%`
    );
  }

  const { data: conversations } = await query;

  // Get counts per status
  const { data: allConversations } = await supabase
    .from("conversations")
    .select("status")
    .eq("org_id", profile.org_id);

  const counts: Record<string, number> = { all: allConversations?.length ?? 0 };
  for (const c of allConversations ?? []) {
    counts[c.status] = (counts[c.status] ?? 0) + 1;
  }

  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center"><p className="text-sm text-text-secondary">Loading inbox...</p></div>}>
      <InboxView conversations={conversations ?? []} statusCounts={counts} />
    </Suspense>
  );
}
