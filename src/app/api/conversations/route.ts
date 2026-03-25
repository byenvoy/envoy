import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import type { ConversationStatus } from "@/lib/types/database";

export async function GET(request: NextRequest) {
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

  const params = request.nextUrl.searchParams;
  const status = params.get("status");
  const search = params.get("search");
  const offset = parseInt(params.get("offset") ?? "0", 10);
  const limit = parseInt(params.get("limit") ?? "50", 10);

  let query = supabase
    .from("conversations")
    .select("*")
    .eq("org_id", profile.org_id)
    .order("last_message_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status && status !== "all") {
    query = query.eq("status", status as ConversationStatus);
  }

  if (search) {
    query = query.or(
      `customer_email.ilike.%${search}%,customer_name.ilike.%${search}%,subject.ilike.%${search}%`
    );
  }

  const { data: conversations } = await query;

  return NextResponse.json({ conversations: conversations ?? [] });
}
