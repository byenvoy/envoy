import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
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
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const { count: totalPages } = await supabase
    .from("knowledge_base_pages")
    .select("*", { count: "exact", head: true })
    .eq("org_id", profile.org_id)
    .eq("is_active", true);

  // Pages that have at least one chunk are considered embedded
  const { data: embeddedData } = await supabase
    .from("knowledge_base_chunks")
    .select("page_id")
    .eq("org_id", profile.org_id);

  const embeddedPages = new Set(embeddedData?.map((c) => c.page_id) ?? []).size;

  const totalChunks = embeddedData?.length ?? 0;

  return NextResponse.json({
    totalPages: totalPages ?? 0,
    embeddedPages,
    totalChunks,
  });
}
