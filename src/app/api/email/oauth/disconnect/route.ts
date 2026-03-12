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
    .select("org_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const { provider } = await request.json();
  if (provider !== "google" && provider !== "microsoft") {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Get the connection to find the email address
  const { data: connection } = await admin
    .from("email_connections")
    .select("email_address")
    .eq("org_id", profile.org_id)
    .eq("provider", provider)
    .single();

  // Delete the connection
  await admin
    .from("email_connections")
    .delete()
    .eq("org_id", profile.org_id)
    .eq("provider", provider);

  // Deactivate the associated email address
  if (connection) {
    await admin
      .from("email_addresses")
      .update({ is_active: false })
      .eq("org_id", profile.org_id)
      .eq("email_address", connection.email_address)
      .eq("connection_type", "oauth");
  }

  return NextResponse.json({ ok: true });
}
