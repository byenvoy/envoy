import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { upsertOrgSkill, deleteOrgSkill } from "../upsert";

const TONE_DESCRIPTIONS: Record<string, string> = {
  professional:
    "Write in a professional, polished tone. Use clear and precise language. Be courteous but not overly familiar. Avoid slang and casual phrasing.",
  casual:
    "Write in a casual, conversational tone. Use contractions freely, keep sentences short, and sound approachable — like a helpful colleague, not a corporate representative.",
  technical:
    "Write in a technical, detail-oriented tone. Be precise with terminology, include specifics where relevant, and assume the reader is comfortable with technical language. Stay clear but don't oversimplify.",
  friendly:
    "Write in a warm, friendly tone. Be empathetic and personable. Use the customer's name when available. Show genuine care about their issue while staying helpful and solution-focused.",
};

/**
 * Render a per-org `voice` skill from organization settings.
 *
 * The agent reads this skill during the draft-reply phase. Voice skill
 * is the SOLE source of truth for greeting / sign-off / tone — there are
 * no separate reads of organizations.{tone,greetingTemplate,signOff} in
 * the agent pipeline.
 *
 * The settings columns remain the canonical user-facing fields; this
 * renderer translates them into a markdown skill body the model can read.
 */
export async function renderVoiceSkill(orgId: string): Promise<{
  description: string;
  body: string;
} | null> {
  const org = await db
    .select({
      tone: organizations.tone,
      customInstructions: organizations.customInstructions,
      greetingTemplate: organizations.greetingTemplate,
      signOff: organizations.signOff,
    })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .then((r) => r[0]);

  if (!org) return null;

  const toneDescription = TONE_DESCRIPTIONS[org.tone] ?? `Write in a ${org.tone} tone.`;

  const sections: string[] = ["# Voice and tone", "", "## Tone", toneDescription];

  if (org.greetingTemplate) {
    sections.push(
      "",
      "## Greeting",
      `Begin replies with the template: "${org.greetingTemplate}". The \`{name}\` placeholder should be replaced with the customer's first name (identifiable from their email signature or address). If the customer uses a different name or nickname for themselves, use that instead.`
    );
  } else {
    sections.push(
      "",
      "## Greeting",
      "Do not include a greeting — open directly with the body of the reply."
    );
  }

  if (org.signOff) {
    sections.push(
      "",
      "## Sign-off",
      `End every reply with: "${org.signOff}"`
    );
  } else {
    sections.push("", "## Sign-off", "No sign-off — end the reply directly after the body.");
  }

  if (org.customInstructions) {
    sections.push("", "## Organization-specific instructions", org.customInstructions);
  }

  return {
    description:
      "Voice, tone, greeting, and sign-off rules for this organization, plus any custom drafting instructions. Read during the draft-reply phase.",
    body: sections.join("\n"),
  };
}

/** Re-render and upsert the voice skill for an org. Call after any settings change. */
export async function syncVoiceSkill(
  orgId: string,
  updatedByUserId?: string | null
): Promise<void> {
  const rendered = await renderVoiceSkill(orgId);
  if (!rendered) {
    await deleteOrgSkill(orgId, "voice");
    return;
  }
  await upsertOrgSkill({
    orgId,
    name: "voice",
    description: rendered.description,
    body: rendered.body,
    updatedByUserId,
  });
}
