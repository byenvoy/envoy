import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/db/helpers";
import { db } from "@/lib/db";
import { teamInvites } from "@/lib/db/schema";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  const auth = await withAuth();
  if (!auth.success) return auth.response;
  const { userId, orgId, role } = auth.context;

  if (role !== "owner") {
    return NextResponse.json({ error: "Only owners can invite" }, { status: 403 });
  }

  const { email, role: inviteRoleInput } = await request.json();
  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const inviteRole = inviteRoleInput === "owner" ? "owner" : "agent";
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

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
