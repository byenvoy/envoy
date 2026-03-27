import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { integrations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/db/helpers";

export async function POST() {
  const auth = await withAuth();
  if (!auth.success) return auth.response;
  const { orgId } = auth.context;

  await db
    .delete(integrations)
    .where(
      and(
        eq(integrations.orgId, orgId),
        eq(integrations.provider, "shopify")
      )
    );

  return NextResponse.json({ ok: true });
}
