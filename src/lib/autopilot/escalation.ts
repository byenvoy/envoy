import { db } from "@/lib/db";
import { conversations, organizations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createLLMProvider } from "@/lib/rag/llm";
import { logUsage } from "@/lib/usage/log";
import { isCloud } from "@/lib/config";

const ESCALATION_MODEL = "claude-haiku-4-5-20251001";

/**
 * Check if a customer reply to an auto-sent message indicates dissatisfaction
 * or a desire to escalate. If so, disable autopilot for the conversation thread.
 *
 * Returns true if the thread was escalated.
 */
export async function checkAndEscalateThread({
  conversationId,
  customerMessage,
  orgId,
}: {
  conversationId: string;
  customerMessage: string;
  orgId: string;
}): Promise<boolean> {
  const system = `You are analyzing a customer's reply to an automated support email. Determine if the customer is expressing dissatisfaction, confusion, frustration, or a desire to speak with a human agent.

Output valid JSON with these fields:
- escalate: boolean — true if the customer seems unhappy with the response, confused by it, or wants to talk to a human
- reasoning: one sentence explaining your assessment

Be sensitive to subtle signals of dissatisfaction. When in doubt, escalate.

Output ONLY the JSON object, no markdown or extra text.`;

  const user = `Customer reply:
${customerMessage}`;

  try {
    let model = ESCALATION_MODEL;
    if (!isCloud()) {
      const org = await db
        .select({ preferredModel: organizations.preferredModel })
        .from(organizations)
        .where(eq(organizations.id, orgId))
        .then((r) => r[0]);
      if (org?.preferredModel) model = org.preferredModel;
    }
    const llm = await createLLMProvider(model, orgId);
    const response = await llm.generateDraft(system, user);

    await logUsage({
      orgId,
      callType: "autopilot_escalation",
      model: response.model,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
    });

    const cleaned = response.text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    if (parsed.escalate === true) {
      await db
        .update(conversations)
        .set({ autopilotDisabled: true })
        .where(eq(conversations.id, conversationId));

      console.log(
        `Autopilot escalation: disabled for conversation ${conversationId} — ${parsed.reasoning}`
      );
      return true;
    }

    return false;
  } catch (error) {
    console.error("Escalation check failed:", error);
    // On failure, be safe and escalate
    await db
      .update(conversations)
      .set({ autopilotDisabled: true })
      .where(eq(conversations.id, conversationId));
    return true;
  }
}
