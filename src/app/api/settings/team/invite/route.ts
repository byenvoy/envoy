import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/db/helpers";
import { db } from "@/lib/db";
import { teamInvites, organizations, profiles } from "@/lib/db/schema";
import { user as userTable } from "@/lib/db/schema/auth";
import { eq } from "drizzle-orm";
import { Resend } from "resend";
import crypto from "crypto";
import { requireOwner } from "@/lib/permissions";
import { teamInvite } from "@/lib/email/templates";
import { captureEvent } from "@/lib/posthog-server";

const INVITE_EXPIRES_IN_DAYS = 7;

const getResend = () => new Resend(process.env.RESEND_API_KEY);
const fromEmail = process.env.RESEND_FROM_EMAIL ?? "Envoy <onboarding@resend.dev>";

export async function POST(request: NextRequest) {
  const auth = await withAuth();
  if (!auth.success) return auth.response;
  const { userId, orgId, role } = auth.context;

  const denied = requireOwner(role);
  if (denied) return denied;

  const { email, role: inviteRoleInput } = await request.json();
  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const inviteRole = inviteRoleInput === "owner" ? "owner" : "agent";
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(
    Date.now() + INVITE_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000,
  );

  try {
    const invite = await db
      .insert(teamInvites)
      .values({
        orgId,
        email,
        role: inviteRole,
        invitedBy: userId,
        token,
        expiresAt,
      })
      .returning()
      .then((r) => r[0]);

    // Send invite email
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const inviteUrl = `${appUrl}/api/invite/${token}`;

    const [org, inviter] = await Promise.all([
      db
        .select({ name: organizations.name })
        .from(organizations)
        .where(eq(organizations.id, orgId))
        .then((r) => r[0]),
      db
        .select({ fullName: profiles.fullName, email: userTable.email })
        .from(userTable)
        .leftJoin(profiles, eq(profiles.id, userTable.id))
        .where(eq(userTable.id, userId))
        .then((r) => r[0]),
    ]);

    const { subject, html, text } = teamInvite({
      inviterFullName: inviter?.fullName ?? null,
      inviterEmail: inviter?.email ?? "",
      orgName: org?.name ?? null,
      role: inviteRole,
      url: inviteUrl,
      expiresInDays: INVITE_EXPIRES_IN_DAYS,
    });

    void getResend().emails.send({
      from: fromEmail,
      to: email,
      subject,
      html,
      text,
    });

    captureEvent(userId, orgId, "team_member_invited", { invite_role: inviteRole });

    return NextResponse.json({
      invite: {
        id: invite.id,
        org_id: invite.orgId,
        email: invite.email,
        role: invite.role,
        invited_by: invite.invitedBy,
        token: invite.token,
        accepted_at: invite.acceptedAt,
        expires_at: invite.expiresAt,
        created_at: invite.createdAt,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
