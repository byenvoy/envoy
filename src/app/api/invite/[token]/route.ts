import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Redirect to login with a return URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    return NextResponse.redirect(
      `${appUrl}/login?redirect=/api/invite/${token}`
    );
  }

  const admin = createAdminClient();

  // Find the invite
  const { data: invite } = await admin
    .from("team_invites")
    .select("*")
    .eq("token", token)
    .is("accepted_at", null)
    .single();

  if (!invite) {
    return NextResponse.json(
      { error: "Invalid or expired invite" },
      { status: 404 }
    );
  }

  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: "Invite has expired" }, { status: 410 });
  }

  // Check if user already has a profile in this org
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .eq("org_id", invite.org_id)
    .single();

  if (!existing) {
    // Update existing profile to join this org, or create new one
    const { data: currentProfile } = await admin
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .single();

    if (currentProfile) {
      await admin
        .from("profiles")
        .update({ org_id: invite.org_id, role: invite.role })
        .eq("id", user.id);
    } else {
      await admin.from("profiles").insert({
        id: user.id,
        org_id: invite.org_id,
        full_name: user.user_metadata?.full_name ?? null,
        role: invite.role,
      });
    }
  }

  // Mark invite as accepted
  await admin
    .from("team_invites")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invite.id);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return NextResponse.redirect(`${appUrl}/inbox`);
}
