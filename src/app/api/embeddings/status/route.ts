import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { knowledgeBasePages, knowledgeBaseChunks } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { withAuth } from "@/lib/db/helpers";

export async function GET() {
  const auth = await withAuth();
  if (!auth.success) return auth.response;
  const { orgId } = auth.context;

  const totalPagesResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(knowledgeBasePages)
    .where(
      and(
        eq(knowledgeBasePages.orgId, orgId),
        eq(knowledgeBasePages.isActive, true)
      )
    )
    .then((r) => r[0]);

  const totalPages = totalPagesResult?.count ?? 0;

  // Pages that have at least one chunk are considered embedded
  const chunkData = await db
    .select({ pageId: knowledgeBaseChunks.pageId })
    .from(knowledgeBaseChunks)
    .where(eq(knowledgeBaseChunks.orgId, orgId));

  const embeddedPages = new Set(chunkData.map((c) => c.pageId)).size;
  const totalChunks = chunkData.length;

  return NextResponse.json({
    totalPages,
    embeddedPages,
    totalChunks,
  });
}
