import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { profiles, teamInvites } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { auth } from "@/lib/auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    // Redirect to login with a return URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    return NextResponse.redirect(
      `${appUrl}/login?redirect=/api/invite/${token}`
    );
  }

  const user = session.user;

  // Find the invite
  const invite = await db
    .select()
    .from(teamInvites)
    .where(
      and(
        eq(teamInvites.token, token),
        isNull(teamInvites.acceptedAt)
      )
    )
    .then((r) => r[0]);

  if (!invite) {
    return NextResponse.json(
      { error: "Invalid or expired invite" },
      { status: 404 }
    );
  }

  if (new Date(invite.expiresAt) < new Date()) {
    return NextResponse.json({ error: "Invite has expired" }, { status: 410 });
  }

  // Check if user already has a profile in this org
  const existing = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(
      and(
        eq(profiles.id, user.id),
        eq(profiles.orgId, invite.orgId)
      )
    )
    .then((r) => r[0]);

  if (!existing) {
    // Update existing profile to join this org, or create new one
    const currentProfile = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.id, user.id))
      .then((r) => r[0]);

    if (currentProfile) {
      await db
        .update(profiles)
        .set({ orgId: invite.orgId, role: invite.role })
        .where(eq(profiles.id, user.id));
    } else {
      await db.insert(profiles).values({
        id: user.id,
        orgId: invite.orgId,
        fullName: user.name ?? null,
        role: invite.role,
      });
    }
  }

  // Mark invite as accepted
  await db
    .update(teamInvites)
    .set({ acceptedAt: new Date() })
    .where(eq(teamInvites.id, invite.id));

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return NextResponse.redirect(`${appUrl}/inbox`);
}
