import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/db/helpers";
import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireOwner } from "@/lib/permissions";
import { syncVoiceSkill } from "@/lib/skills/renderers/voice";
import { getPostHogClient } from "@/lib/posthog-server";

const VALID_TONES = ["professional", "casual", "technical", "friendly"];

export async function POST(request: NextRequest) {
  const auth = await withAuth();
  if (!auth.success) return auth.response;
  const { orgId, role } = auth.context;

  const denied = requireOwner(role);
  if (denied) return denied;

  const { tone, custom_instructions, greeting_template, sign_off } = await request.json();

  if (tone && !VALID_TONES.includes(tone)) {
    return NextResponse.json({ error: "Invalid tone" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (tone) update.tone = tone;
  if (custom_instructions !== undefined) update.customInstructions = custom_instructions;
  if (greeting_template !== undefined) update.greetingTemplate = greeting_template;
  if (sign_off !== undefined) update.signOff = sign_off;

  try {
    await db
      .update(organizations)
      .set(update)
      .where(eq(organizations.id, orgId));

    // Re-render the voice skill so the agent pipeline reflects the new settings
    await syncVoiceSkill(orgId, auth.context.userId);

    getPostHogClient().capture({
      distinctId: auth.context.userId,
      event: "tone_configured",
      properties: { org_id: orgId, tone: tone ?? undefined },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
