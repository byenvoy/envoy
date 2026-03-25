import { createClient } from "@/lib/supabase/server";
import { createShopifyClient } from "@/lib/integrations/shopify-client-factory";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "No profile" }, { status: 403 });
  }

  // Fetch conversation
  const { data: conversation } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", id)
    .eq("org_id", profile.org_id)
    .single();

  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Fetch all messages in chronological order
  const { data: messages } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  // Fetch latest pending draft
  const { data: draft } = await supabase
    .from("drafts")
    .select("*")
    .eq("conversation_id", id)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  // Fetch Shopify customer context independently (if Shopify is connected)
  let shopifyCustomer = null;
  try {
    const shopifyClient = await createShopifyClient(profile.org_id);
    if (shopifyClient) {
      shopifyCustomer = await shopifyClient.getCustomerContext(
        conversation.customer_email
      );
    }
  } catch {
    // Shopify lookup failed — not critical, continue without it
  }

  return NextResponse.json({
    conversation,
    messages: messages ?? [],
    draft,
    shopifyCustomer,
  });
}
