import { NextResponse } from "next/server";
import { withAuth } from "@/lib/db/helpers";
import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireOwner } from "@/lib/permissions";

export async function POST() {
  const auth = await withAuth();
  if (!auth.success) return auth.response;
  const { orgId, role } = auth.context;

  const denied = requireOwner(role);
  if (denied) return denied;

  await db
    .update(organizations)
    .set({ pollingEnabled: true, updatedAt: new Date() })
    .where(eq(organizations.id, orgId));

  return NextResponse.json({ ok: true });
}
