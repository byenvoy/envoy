import { buildValidationPrompt } from "@/lib/autopilot/prompts";
import { callAnthropic, parseJsonResponse } from "../lib/llm";
import { loadFixtures } from "../lib/load-fixtures";
import type {
  SuiteReport,
  ValidatorFixture,
  ValidatorResult,
  ValidatorVerdict,
} from "../lib/types";

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

/**
 * Matches the live pipeline threshold in src/lib/autopilot/gates/validate-draft.ts.
 * Kept here (not imported) so the eval stays independent of any refactors to
 * the live gate code.
 */
const VALIDATION_CONFIDENCE_THRESHOLD = 0.85;

/**
 * Run the draft validator (Gate 4) suite.
 *
 * Fixtures pre-define the verdict a correct validator should return. The eval
 * compares the actual verdict to expected on a per-check basis AND compares
 * the overall auto-send decision (checks-all-pass + confidence threshold).
 *
 * No LLM judge needed — the expected output IS the ground truth.
 */
export async function runValidatorSuite(
  model: string = DEFAULT_MODEL
): Promise<SuiteReport<ValidatorResult>> {
  const fixtures = await loadFixtures<ValidatorFixture>("validator");
  const startedAt = new Date().toISOString();
  const results: ValidatorResult[] = [];

  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (const fixture of fixtures) {
    process.stdout.write(`  running ${fixture.id}... `);
    const { system, user } = buildValidationPrompt(
      fixture.inputs.customerMessage,
      fixture.inputs.draftContent,
      fixture.inputs.chunks,
      fixture.inputs.customerContext,
      fixture.inputs.conversationHistory
    );

    const response = await callAnthropic({ model, system, user, maxTokens: 1024 });
    const verdict = parseJsonResponse<ValidatorVerdict>(response.text);

    const checkMatches = {
      responsiveness:
        verdict.checks.responsiveness.pass === fixture.expected.checks.responsiveness,
      accuracy: verdict.checks.accuracy.pass === fixture.expected.checks.accuracy,
      scope: verdict.checks.scope.pass === fixture.expected.checks.scope,
      completeness:
        verdict.checks.completeness.pass === fixture.expected.checks.completeness,
    };

    const allChecksPassed = Object.values(verdict.checks).every((c) => c.pass);
    const actualShouldAutoSend =
      allChecksPassed && verdict.confidence >= VALIDATION_CONFIDENCE_THRESHOLD;
    const overallMatch = actualShouldAutoSend === fixture.expected.shouldAutoSend;

    results.push({
      fixtureId: fixture.id,
      description: fixture.description,
      verdict,
      expected: fixture.expected,
      checkMatches,
      overallMatch,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
    });

    totalInputTokens += response.inputTokens;
    totalOutputTokens += response.outputTokens;

    const allMatched = Object.values(checkMatches).every(Boolean) && overallMatch;
    process.stdout.write(`${allMatched ? "✓" : "✗"}\n`);
  }

  const passed = results.filter(
    (r) => Object.values(r.checkMatches).every(Boolean) && r.overallMatch
  ).length;

  return {
    suite: "validator",
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
