import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateDraftForTicket } from "@/lib/email/generate-draft";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

  // Verify ticket belongs to user's org
  const { data: ticket } = await supabase
    .from("tickets")
    .select("id")
    .eq("id", id)
    .eq("org_id", profile.org_id)
    .single();

  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  try {
    await generateDraftForTicket(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to regenerate draft:", error);
    return NextResponse.json(
      { error: "Failed to regenerate draft" },
      { status: 500 }
    );
  }
}
