import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseFile } from "@/lib/parse/file";
import { syncPageChunks } from "@/lib/rag/sync";
import { computeHash } from "@/lib/crawl/hash";
import type { KnowledgeBasePage } from "@/lib/types/database";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

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

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "File is required" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "File must be under 10 MB" },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let parsed;
  try {
    parsed = await parseFile(buffer, file.name, file.type);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to parse file" },
      { status: 422 }
    );
  }

  const contentHash = computeHash(parsed.content);
  const admin = createAdminClient();

  const { data: page, error } = await admin
    .from("knowledge_base_pages")
    .insert({
      org_id: profile.org_id,
      url: null,
      title: parsed.title,
      markdown_content: parsed.content,
      content_hash: contentHash,
      source: "upload",
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await syncPageChunks(admin, page as KnowledgeBasePage);

  return NextResponse.json({ page });
}
