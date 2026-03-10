import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
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

  const { data: emailAddress } = await supabase
    .from("email_addresses")
    .select("*")
    .eq("org_id", profile.org_id)
    .eq("is_active", true)
    .limit(1)
    .single();

  return NextResponse.json({ email_address: emailAddress });
}

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

  const body = await request.json();
  const { email_address, display_name } = body;

  if (!email_address || typeof email_address !== "string") {
    return NextResponse.json(
      { error: "email_address is required" },
      { status: 400 }
    );
  }

  // Check if org already has an email address
  const { data: existing } = await supabase
    .from("email_addresses")
    .select("id")
    .eq("org_id", profile.org_id)
    .limit(1)
    .single();

  if (existing) {
    // Update existing
    const { error } = await supabase
      .from("email_addresses")
      .update({ email_address, display_name, is_active: true })
      .eq("id", existing.id);

    if (error) {
      return NextResponse.json(
        { error: "Failed to update email address" },
        { status: 500 }
      );
    }
  } else {
    // Insert new
    const { error } = await supabase.from("email_addresses").insert({
      org_id: profile.org_id,
      email_address,
      display_name,
    });

    if (error) {
      return NextResponse.json(
        { error: "Failed to save email address" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ ok: true });
}
