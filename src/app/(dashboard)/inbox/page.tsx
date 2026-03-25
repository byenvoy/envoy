import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { createShopifyClient } from "@/lib/integrations/shopify-client-factory";
import { redirect } from "next/navigation";
import { InboxView } from "@/components/inbox/inbox-view";
import type { ConversationStatus } from "@/lib/types/database";

const PAGE_SIZE = 50;

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

  const orgId = profile.org_id;

  // Fetch conversations with filters + pagination
  let query = supabase
    .from("conversations")
    .select("*")
    .eq("org_id", orgId)
    .order("last_message_at", { ascending: false })
    .limit(PAGE_SIZE);

  const effectiveStatus = statusFilter ?? "open";
  if (effectiveStatus !== "all") {
    query = query.eq("status", effectiveStatus as ConversationStatus);
  }

  if (search) {
    query = query.or(
      `customer_email.ilike.%${search}%,customer_name.ilike.%${search}%,subject.ilike.%${search}%`
    );
  }

  // Fetch conversations and counts in parallel
  const [{ data: conversations }, { data: allConversations }] = await Promise.all([
    query,
    supabase
      .from("conversations")
      .select("status")
      .eq("org_id", orgId),
  ]);

  const counts: Record<string, number> = { all: allConversations?.length ?? 0 };
  for (const c of allConversations ?? []) {
    counts[c.status] = (counts[c.status] ?? 0) + 1;
  }

  const convoList = conversations ?? [];
  const hasMore = convoList.length === PAGE_SIZE;

  // Prefetch first conversation's detail to eliminate the waterfall
  let initialDetail = null;
  if (convoList.length > 0) {
    const firstId = convoList[0].id;

    const [{ data: messages }, { data: draft }] = await Promise.all([
      supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", firstId)
        .order("created_at", { ascending: true }),
      supabase
        .from("drafts")
        .select("*")
        .eq("conversation_id", firstId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .single(),
    ]);

    let shopifyCustomer = null;
    try {
      const shopifyClient = await createShopifyClient(orgId);
      if (shopifyClient) {
        shopifyCustomer = await shopifyClient.getCustomerContext(
          convoList[0].customer_email
        );
      }
    } catch {
      // Not critical
    }

    initialDetail = {
      conversation: convoList[0],
      messages: messages ?? [],
      draft,
      shopifyCustomer,
    };
  }

  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center"><p className="text-sm text-text-secondary">Loading inbox...</p></div>}>
      <InboxView
        conversations={convoList}
        statusCounts={counts}
        initialDetail={initialDetail}
        hasMore={hasMore}
        pageSize={PAGE_SIZE}
      />
    </Suspense>
  );
}
