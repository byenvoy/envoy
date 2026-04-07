import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/db/helpers";
import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { SUPPORTED_MODELS } from "@/lib/rag/llm";
import { requireOwner } from "@/lib/permissions";

export async function POST(request: NextRequest) {
  const auth = await withAuth();
  if (!auth.success) return auth.response;
  const { orgId, role } = auth.context;

  const denied = requireOwner(role);
  if (denied) return denied;

  const { model } = await request.json();
  if (!model || !SUPPORTED_MODELS[model]) {
    return NextResponse.json({ error: "Invalid model" }, { status: 400 });
  }

  try {
    await db
      .update(organizations)
      .set({ preferredModel: model })
      .where(eq(organizations.id, orgId));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
