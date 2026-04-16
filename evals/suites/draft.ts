import { buildDraftPrompt } from "@/lib/rag/prompt";
import { judgeDraft } from "../lib/judge";
import { callAnthropic } from "../lib/llm";
import { loadFixtures } from "../lib/load-fixtures";
import type {
  DraftFixture,
  DraftResult,
  SuiteReport,
} from "../lib/types";

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

/**
 * Run the draft generation suite.
 *
 * For each fixture:
 *   1. Build the system + user prompts via the real buildDraftPrompt
 *      (so any change to the prompt is what's being measured).
 *   2. Call the generator model to produce a draft.
 *   3. Call the judge model to score the draft against the fixture rubric.
 *
 * Sequential to keep output readable and avoid rate-limit fights on small fixture
 * sets. If this grows past ~30 fixtures, parallelize with a concurrency cap.
 */
export async function runDraftSuite(
  model: string = DEFAULT_MODEL
): Promise<SuiteReport<DraftResult>> {
  const fixtures = await loadFixtures<DraftFixture>("draft");
  const startedAt = new Date().toISOString();
  const results: DraftResult[] = [];

  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (const fixture of fixtures) {
    process.stdout.write(`  running ${fixture.id}... `);
    const { system, user } = buildDraftPrompt(fixture.inputs);

    const draft = await callAnthropic({ model, system, user });
    const { verdict, usage: judgeUsage } = await judgeDraft(fixture, draft.text);

    results.push({
      fixtureId: fixture.id,
      description: fixture.description,
      draft: draft.text,
      verdict,
      inputTokens: draft.inputTokens,
      outputTokens: draft.outputTokens,
      judgeInputTokens: judgeUsage.inputTokens,
      judgeOutputTokens: judgeUsage.outputTokens,
    });

    totalInputTokens += draft.inputTokens + judgeUsage.inputTokens;
    totalOutputTokens += draft.outputTokens + judgeUsage.outputTokens;

    const mark = verdict.overall.pass ? "✓" : "✗";
    process.stdout.write(`${mark}\n`);
  }

  const passed = results.filter((r) => r.verdict.overall.pass).length;

  return {
    suite: "draft",
    model,
    startedAt,
    finishedAt: new Date().toISOString(),
    results,
    summary: {
      total: results.length,
      passed,
      failed: results.length - passed,
      totalInputTokens,
      totalOutputTokens,
    },
  };
}
