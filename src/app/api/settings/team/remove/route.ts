import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/db/helpers";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import { user } from "@/lib/db/schema/auth";
import { eq } from "drizzle-orm";
import { requireOwner } from "@/lib/permissions";

export async function POST(request: NextRequest) {
  const auth = await withAuth();
  if (!auth.success) return auth.response;
  const { userId, orgId, role } = auth.context;

  const denied = requireOwner(role);
  if (denied) return denied;

  const { profile_id } = await request.json();
  if (!profile_id || profile_id === userId) {
    return NextResponse.json({ error: "Cannot remove yourself" }, { status: 400 });
  }

  // Verify the target profile belongs to the same org
  const target = await db
    .select({ id: profiles.id, orgId: profiles.orgId, role: profiles.role })
    .from(profiles)
    .where(eq(profiles.id, profile_id))
    .then((r) => r[0]);

  if (!target || target.orgId !== orgId) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  if (target.role === "owner") {
    return NextResponse.json({ error: "Cannot remove an owner" }, { status: 400 });
  }

  try {
    await db.delete(profiles).where(eq(profiles.id, profile_id));
    // Delete the user account entirely so they don't end up logged in with no org access
    await db.delete(user).where(eq(user.id, profile_id));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
