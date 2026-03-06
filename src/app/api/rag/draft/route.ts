import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { retrieveAndDraft } from "@/lib/rag/retrieve";

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

  const { data: org } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", profile.org_id)
    .single();

  const body = await request.json();
  const { message } = body;

  if (!message || typeof message !== "string") {
    return NextResponse.json(
      { error: "Message is required" },
      { status: 400 }
    );
  }

  try {
    const adminClient = createAdminClient();
    const result = await retrieveAndDraft({
      supabase: adminClient,
      orgId: profile.org_id,
      companyName: org?.name ?? "Our Company",
      customerMessage: message,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Draft generation failed:", error);
    return NextResponse.json(
      { error: "Failed to generate draft" },
      { status: 500 }
    );
  }
}
