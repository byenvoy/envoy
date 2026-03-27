import { NextResponse } from "next/server";
import { withAuth } from "@/lib/db/helpers";
import { syncAllPages } from "@/lib/rag/sync";

export async function POST() {
  const auth = await withAuth();
  if (!auth.success) return auth.response;
  const { orgId } = auth.context;

  try {
    const stats = await syncAllPages(orgId);
    return NextResponse.json(stats);
  } catch (error) {
    console.error("Embedding generation failed:", error);
    return NextResponse.json(
      { error: "Failed to generate embeddings" },
      { status: 500 }
    );
  }
}
