import { callAnthropic, parseJsonResponse, type LLMResponse } from "./llm";
import type { DraftFixture, DraftJudgeVerdict } from "./types";

const JUDGE_MODEL = "claude-haiku-4-5-20251001";

/**
 * LLM-as-judge for the draft generation suite.
 *
 * The draft is free text, so we can't exact-match. Instead we give Haiku the
 * fixture's rubric (mustDo / mustAvoid / toneNote) and the retrieved context,
 * then ask for a structured verdict across four dimensions.
 *
 * We intentionally use a different, smaller model than the one that generated
 * the draft to reduce the chance of the generator and judge sharing a blind
 * spot. Haiku is also cheap — this lets us run a lot of fixtures without
 * burning tokens.
 */
const JUDGE_SYSTEM = `You are grading an AI-generated customer support email draft against a fixture rubric. Return a structured JSON verdict — no preamble, no markdown fences.

<criteria>
<responsiveness>
Does the draft do everything listed under <must_do> in the rubric? If any required item is missing or only partially addressed, this check fails.
</responsiveness>

<grounding>
Is every factual claim in the draft supported by <knowledge_base> or <customer_context>? If the draft invents tracking numbers, dates, policies, or other specifics, this check fails. Claims that are plausible but not actually grounded in the provided context still fail.
</grounding>

<scope>
Does the draft avoid everything listed under <must_avoid>, and does it avoid making unilateral commitments on behalf of the company? Restating existing policy is fine; claiming "I've processed your refund" or "I'll make an exception" is not.
</scope>

<tone>
Does the draft match the tone note in the rubric (if provided)? If no tone note is provided, default to friendly and professional — pass unless the tone is clearly off.
</tone>
</criteria>

<output_format>
Output JSON only:
{
  "checks": {
    "responsiveness": { "pass": boolean, "note": string },
    "grounding": { "pass": boolean, "note": string },
    "scope": { "pass": boolean, "note": string },
    "tone": { "pass": boolean, "note": string }
  },
  "overall": { "pass": boolean, "note": string }
}

The overall pass is true only when all four checks pass.
</output_format>`;

export async function judgeDraft(
  fixture: DraftFixture,
  draft: string
): Promise<{ verdict: DraftJudgeVerdict; usage: LLMResponse }> {
  const kbBlock = fixture.inputs.chunks
    .map((c, i) => {
      const source = c.sourceUrl ? `    <source>${c.sourceUrl}</source>\n` : "";
      return `  <document index="${i + 1}">\n${source}    <content>\n${c.content}\n    </content>\n  </document>`;
    })
    .join("\n");

  const customerContextBlock = fixture.inputs.customerContext
    ? `<customer_context>\n${JSON.stringify(fixture.inputs.customerContext, null, 2)}\n</customer_context>`
    : "";

  const rubricBlock = [
    "<rubric>",
    "<must_do>",
    ...fixture.rubric.mustDo.map((x) => `- ${x}`),
    "</must_do>",
    "<must_avoid>",
    ...fixture.rubric.mustAvoid.map((x) => `- ${x}`),
    "</must_avoid>",
    fixture.rubric.toneNote ? `<tone_note>${fixture.rubric.toneNote}</tone_note>` : "",
    "</rubric>",
  ]
    .filter(Boolean)
    .join("\n");

  const user = [
    `<knowledge_base>\n${kbBlock}\n</knowledge_base>`,
    customerContextBlock,
    `<customer_email>\n${fixture.inputs.customerMessage}\n</customer_email>`,
    `<draft_reply>\n${draft}\n</draft_reply>`,
    rubricBlock,
    "Grade the draft against the rubric and return the JSON verdict.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const response = await callAnthropic({
    model: JUDGE_MODEL,
    system: JUDGE_SYSTEM,
    user,
    maxTokens: 1024,
  });

  const verdict = parseJsonResponse<DraftJudgeVerdict>(response.text);
  return { verdict, usage: response };
}
