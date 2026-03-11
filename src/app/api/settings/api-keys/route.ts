import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encrypt } from "@/lib/email/encryption";

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
    return NextResponse.json({ error: "Only owners can manage API keys" }, { status: 403 });
  }

  const { provider_key, api_key } = await request.json();

  if (!provider_key || typeof provider_key !== "string") {
    return NextResponse.json({ error: "provider_key is required" }, { status: 400 });
  }

  if (!api_key || typeof api_key !== "string" || api_key.trim().length === 0) {
    return NextResponse.json({ error: "API key is required" }, { status: 400 });
  }

  const encrypted = encrypt(api_key.trim());

  // Upsert: insert or update on conflict
  const { error } = await supabase
    .from("org_api_keys")
    .upsert(
      {
        org_id: profile.org_id,
        provider_key,
        api_key_encrypted: encrypted,
      },
      { onConflict: "org_id,provider_key" }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
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
    return NextResponse.json({ error: "Only owners can manage API keys" }, { status: 403 });
  }

  const { provider_key } = await request.json();

  if (!provider_key || typeof provider_key !== "string") {
    return NextResponse.json({ error: "provider_key is required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("org_api_keys")
    .delete()
    .eq("org_id", profile.org_id)
    .eq("provider_key", provider_key);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
