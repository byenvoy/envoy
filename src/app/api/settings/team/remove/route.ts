import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "owner") {
    return NextResponse.json({ error: "Only owners can remove members" }, { status: 403 });
  }

  const { profile_id } = await request.json();
  if (!profile_id || profile_id === user.id) {
    return NextResponse.json({ error: "Cannot remove yourself" }, { status: 400 });
  }

  // Verify the target profile belongs to the same org
  const admin = createAdminClient();
  const { data: target } = await admin
    .from("profiles")
    .select("id, org_id, role")
    .eq("id", profile_id)
    .single();

  if (!target || target.org_id !== profile.org_id) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  if (target.role === "owner") {
    return NextResponse.json({ error: "Cannot remove an owner" }, { status: 400 });
  }

  const { error } = await admin.from("profiles").delete().eq("id", profile_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
