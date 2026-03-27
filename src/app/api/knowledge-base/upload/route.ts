import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { knowledgeBasePages } from "@/lib/db/schema";
import { withAuth } from "@/lib/db/helpers";
import { parseFile } from "@/lib/parse/file";
import { syncPageChunks } from "@/lib/rag/sync";
import { computeHash } from "@/lib/crawl/hash";
import type { KnowledgeBasePage } from "@/lib/types/database";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(request: NextRequest) {
  const auth = await withAuth();
  if (!auth.success) return auth.response;
  const { orgId } = auth.context;

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

  try {
    const page = await db
      .insert(knowledgeBasePages)
      .values({
        orgId,
        url: null,
        title: parsed.title,
        markdownContent: parsed.content,
        contentHash,
        source: "upload",
        isActive: true,
      })
      .returning()
      .then((r) => r[0]);

    await syncPageChunks(page);

    return NextResponse.json({ page });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
