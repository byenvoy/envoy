import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/db/helpers";
import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const VALID_TONES = ["professional", "casual", "technical", "friendly"];

export async function POST(request: NextRequest) {
  const auth = await withAuth();
  if (!auth.success) return auth.response;
  const { orgId, role } = auth.context;

  if (role !== "owner") {
    return NextResponse.json({ error: "Only owners can change settings" }, { status: 403 });
  }

  const { tone, custom_instructions, greeting_template } = await request.json();

  if (tone && !VALID_TONES.includes(tone)) {
    return NextResponse.json({ error: "Invalid tone" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (tone) update.tone = tone;
  if (custom_instructions !== undefined) update.customInstructions = custom_instructions;
  if (greeting_template !== undefined) update.greetingTemplate = greeting_template;

  try {
    await db
      .update(organizations)
      .set(update)
      .where(eq(organizations.id, orgId));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
