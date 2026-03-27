import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { knowledgeBasePages, knowledgeBaseChunks } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/db/helpers";
import { syncPageChunks } from "@/lib/rag/sync";
import type { KnowledgeBasePage } from "@/lib/types/database";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await withAuth();
  if (!auth.success) return auth.response;
  const { orgId } = auth.context;

  const { title, content } = await request.json();

  try {
    const page = await db
      .update(knowledgeBasePages)
      .set({
        title,
        markdownContent: content,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(knowledgeBasePages.id, id),
          eq(knowledgeBasePages.orgId, orgId)
        )
      )
      .returning()
      .then((r) => r[0]);

    if (!page) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    await syncPageChunks(page);

    return NextResponse.json({ page });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await withAuth();
  if (!auth.success) return auth.response;
  const { orgId } = auth.context;

  try {
    // Delete chunks first
    await db
      .delete(knowledgeBaseChunks)
      .where(eq(knowledgeBaseChunks.pageId, id));

    // Mark page as inactive
    await db
      .update(knowledgeBasePages)
      .set({ isActive: false, updatedAt: new Date() })
      .where(
        and(
          eq(knowledgeBasePages.id, id),
          eq(knowledgeBasePages.orgId, orgId)
        )
      );

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
