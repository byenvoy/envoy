import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/db/helpers";
import { db } from "@/lib/db";
import { profiles, teamInvites, organizations } from "@/lib/db/schema";
import { user } from "@/lib/db/schema/auth";
import { eq, and } from "drizzle-orm";
import { requireOwner } from "@/lib/permissions";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const fromEmail = process.env.RESEND_FROM_EMAIL ?? "Envoy <onboarding@resend.dev>";

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

  // Look up email before deleting (needed for invite cleanup and notification)
  const targetUser = await db
    .select({ email: user.email })
    .from(user)
    .where(eq(user.id, profile_id))
    .then((r) => r[0]);

  try {
    await db.delete(profiles).where(eq(profiles.id, profile_id));
    await db.delete(user).where(eq(user.id, profile_id));
    if (targetUser) {
      await db
        .delete(teamInvites)
        .where(
          and(
            eq(teamInvites.email, targetUser.email),
            eq(teamInvites.orgId, orgId)
          )
        );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  // Notify the removed user
  if (targetUser) {
    const org = await db
      .select({ name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .then((r) => r[0]);

    void resend.emails.send({
      from: fromEmail,
      to: targetUser.email,
      subject: `You've been removed from ${org?.name ?? "a team"} on Envoy`,
      html: `<p>You've been removed from <strong>${org?.name ?? "a team"}</strong> on Envoy. If you think this was a mistake, please contact your team administrator.</p>`,
    });
  }

  return NextResponse.json({ ok: true });
}
