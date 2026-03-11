import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncPageChunks } from "@/lib/rag/sync";
import type { KnowledgeBasePage } from "@/lib/types/database";

export async function POST(request: NextRequest) {
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

  const { title, content } = await request.json();
  if (!title || !content) {
    return NextResponse.json(
      { error: "Title and content are required" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  const { data: page, error } = await admin
    .from("knowledge_base_pages")
    .insert({
      org_id: profile.org_id,
      url: null,
      title,
      markdown_content: content,
      source: "manual",
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Chunk and embed
  await syncPageChunks(admin, page as KnowledgeBasePage);

  return NextResponse.json({ page });
}
