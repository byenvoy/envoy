import { db } from "@/lib/db";
import { autopilotTopics } from "@/lib/db/schema";
import { eq, and, inArray, asc } from "drizzle-orm";
import { upsertOrgSkill, deleteOrgSkill } from "../upsert";

/**
 * Render a per-org `autopilot` skill from the active autopilot topics.
 *
 * The topic list (with UUIDs) is *also* injected into the initial user
 * message of the agent loop so the agent can pick a topicId. This skill
 * supplements that with the rubric-application rules and reminds the
 * agent how thresholds + escalation interact.
 *
 * The agent reads this skill during the autopilot-verdict step.
 */
export async function renderAutopilotSkill(orgId: string): Promise<{
  description: string;
  body: string;
} | null> {
  const topics = await db
    .select()
    .from(autopilotTopics)
    .where(
      and(
        eq(autopilotTopics.orgId, orgId),
        inArray(autopilotTopics.mode, ["shadow", "auto"])
      )
    )
    .orderBy(asc(autopilotTopics.createdAt));

  if (topics.length === 0) return null;

  const sections: string[] = [
    "# Autopilot topics for this organization",
    "",
    "This organization has opted the following topics into autopilot. The topic list in the ticket prompt provides UUIDs and modes — this skill supplies additional context, thresholds, and application rules.",
    "",
    "## Active topics",
    "",
  ];

  for (const topic of topics) {
    sections.push(`### ${topic.name}`);
    sections.push("");
    sections.push(
      `- **Mode:** \`${topic.mode}\` ${
        topic.mode === "auto"
          ? "(auto-sends when confidence exceeds threshold)"
          : "(shadow — logged only, not sent)"
      }`
    );
    sections.push(
      `- **Confidence threshold:** ${topic.confidenceThreshold} — below this, the ticket queues for human review`
    );
    sections.push(`- **Description:** ${topic.description}`);
    sections.push("");
  }

  sections.push(
    "## Applying the rubric",
    "",
    "For each inbound ticket, check if it matches one of the topics above using the `autopilot-verdict` skill's scoring rubric. Set `autopilotTopicId` in `submit_analysis` only when:",
    "1. The ticket clearly fits a topic's description.",
    "2. Your confidence meets or exceeds the topic's confidence threshold.",
    "3. No escalation red flags override the match.",
    "",
    "When in doubt, err toward human review by setting a lower confidence or omitting the topic match."
  );

  return {
    description:
      "This organization's active autopilot topics, their confidence thresholds, and application rules. Read during autopilot-verdict judgment.",
    body: sections.join("\n"),
  };
}

/** Re-render and upsert the autopilot skill. Call after any topic CRUD. */
export async function syncAutopilotSkill(
  orgId: string,
  updatedByUserId?: string | null
): Promise<void> {
  const rendered = await renderAutopilotSkill(orgId);
  if (!rendered) {
    await deleteOrgSkill(orgId, "autopilot");
    return;
  }
  await upsertOrgSkill({
    orgId,
    name: "autopilot",
    description: rendered.description,
    body: rendered.body,
    updatedByUserId,
  });
}
