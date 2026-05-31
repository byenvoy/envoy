import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { knowledgeBasePages } from "@/lib/db/schema";
import { withAuth } from "@/lib/db/helpers";
import { syncPageChunks } from "@/lib/rag/sync";
import { getPostHogClient } from "@/lib/posthog-server";
import type { KnowledgeBasePage } from "@/lib/types/database";

export async function POST(request: NextRequest) {
  const auth = await withAuth();
  if (!auth.success) return auth.response;
  const { orgId } = auth.context;

  const { title, content } = await request.json();
  if (!title || !content) {
    return NextResponse.json(
      { error: "Title and content are required" },
      { status: 400 }
    );
  }

  try {
    const page = await db
      .insert(knowledgeBasePages)
      .values({
        orgId,
        url: null,
        title,
        markdownContent: content,
        source: "manual",
        isActive: true,
      })
      .returning()
      .then((r) => r[0]);

    await syncPageChunks(page);

    getPostHogClient().capture({
      distinctId: auth.context.userId,
      event: "knowledge_base_item_added",
      properties: { source: "manual", org_id: orgId },
    });

    return NextResponse.json({ page });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
