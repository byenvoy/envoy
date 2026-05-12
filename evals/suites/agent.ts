import { runAgentPipeline } from "@/lib/agent/pipeline";
import { loadCoreSkills } from "@/lib/skills/loader";
import type { AutopilotTopicRow } from "@/lib/autopilot/types";
import type { Skill } from "@/lib/skills/types";
import { loadFixtures } from "../lib/load-fixtures";
import type {
  AgentFixture,
  AgentCheckResult,
  AgentResult,
  SuiteReport,
} from "../lib/types";

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

/**
 * Run the agent pipeline eval suite.
 *
 * Each fixture supplies a ticket + org-state snapshot (autopilot topics,
 * org-skill overlays). The suite:
 *   1. Loads core skills from the filesystem
 *   2. Merges fixture org-skill overlays on top (last-write-wins by name)
 *   3. Calls runAgentPipeline with DB-bypassing overrides
 *   4. Scores every dimension the fixture specified — category, autopilot
 *      decision, escalation, draft presence, draft must/must-not contain
 *
 * No LLM-judge step in this version — every check is deterministic or a
 * substring match. LLM-graded draft quality is intentionally deferred
 * until we have golden drafts to compare against.
 *
 * Sequential rather than parallel to avoid rate-limit fights against
 * Anthropic on small fixture sets. Parallelize with a concurrency cap if
 * fixtures grow past ~30.
 */
export async function runAgentSuite(
  model: string = DEFAULT_MODEL
): Promise<SuiteReport<AgentResult>> {
  const fixtures = await loadFixtures<AgentFixture>("agent");
  const startedAt = new Date().toISOString();
  const results: AgentResult[] = [];

  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  // Load core skills once — they're the same across every fixture.
  const coreSkills = await loadCoreSkills();

  // Get the Anthropic API key from env. The eval can't use per-org keys
  // because there's no real org behind the fixture.
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is required to run the agent eval suite");
  }

  for (const fixture of fixtures) {
    process.stdout.write(`  running ${fixture.id}... `);

    try {
      const skills = mergeSkills(coreSkills, fixture.org.orgSkills ?? []);
      const activeTopics = (fixture.org.autopilotTopics ?? []).map(toTopicRow);

      const result = await runAgentPipeline(
        {
          orgId: `eval-${fixture.id}`,
          conversationId: `eval-conv-${fixture.id}`,
          companyName: fixture.org.companyName,
          customerMessage: fixture.input.body,
          customerEmail: fixture.input.customerEmail,
          customerName: fixture.input.customerName ?? null,
          conversationHistory: fixture.input.conversationHistory ?? [],
          autopilotDisabled: fixture.input.autopilotDisabled ?? false,
        },
        {
          skills,
          activeTopics,
          apiKey,
        }
      );

      const checks = scoreFixture(fixture, result.analysis, result.draft?.text ?? null);
      const passed = Object.values(checks).every((c) => c.pass);

      const inputTokens =
        result.analysisUsage.inputTokens + (result.draft?.inputTokens ?? 0);
      const outputTokens =
        result.analysisUsage.outputTokens + (result.draft?.outputTokens ?? 0);

      totalInputTokens += inputTokens;
      totalOutputTokens += outputTokens;

      results.push({
        fixtureId: fixture.id,
        description: fixture.description,
        labels: fixture.labels ?? [],
        actual: {
          category: result.analysis?.category ?? null,
          autopilotTopicId: result.analysis?.autopilotTopicId ?? null,
          autopilotConfidence: result.analysis?.autopilotConfidence ?? null,
          escalationFlag: result.analysis?.escalationFlag ?? null,
          escalationReason: result.analysis?.escalationReason ?? null,
          draft: result.draft?.text ?? null,
        },
        checks,
        passed,
        inputTokens,
        outputTokens,
      });

      process.stdout.write(passed ? "✓\n" : "✗\n");
    } catch (err) {
      process.stdout.write("ERROR\n");
      console.error(`  fixture ${fixture.id} threw:`, err);
      // Treat as failed but keep going so we get a full report
      results.push({
        fixtureId: fixture.id,
        description: fixture.description,
        labels: fixture.labels ?? [],
        actual: {
          category: null,
          autopilotTopicId: null,
          autopilotConfidence: null,
          escalationFlag: null,
          escalationReason: null,
          draft: null,
        },
        checks: {
          category: {
            pass: false,
            note: `Pipeline threw: ${err instanceof Error ? err.message : String(err)}`,
          },
        },
        passed: false,
        inputTokens: 0,
        outputTokens: 0,
      });
    }
  }

  const finishedAt = new Date().toISOString();
  const passed = results.filter((r) => r.passed).length;

  return {
    suite: "agent",
    model,
    startedAt,
    finishedAt,
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

/**
 * Score one fixture's pipeline result. Only includes checks the fixture
 * explicitly specified — fields the fixture omits are skipped entirely
 * (not graded as "missing"), so fixtures can target a narrow set of
 * dimensions if that's what they're for.
 */
function scoreFixture(
  fixture: AgentFixture,
  analysis: { category: string; autopilotTopicId: string | null; autopilotConfidence: number | null; escalationFlag: boolean } | null,
  draft: string | null
): AgentResult["checks"] {
  const checks: AgentResult["checks"] = {};
  const exp = fixture.expected;

  // If the pipeline produced no analysis, every configured check fails.
  if (!analysis) {
    return {
      category: { pass: false, note: "Pipeline produced no analysis (loop did not call submit_analysis)" },
    };
  }

  if (exp.category !== undefined) {
    const pass = analysis.category === exp.category;
    checks.category = {
      pass,
      note: pass ? undefined : `expected ${exp.category}, got ${analysis.category}`,
    };
  }

  if (exp.autopilotTopicId !== undefined) {
    const pass = analysis.autopilotTopicId === exp.autopilotTopicId;
    checks.autopilotTopic = {
      pass,
      note: pass
        ? undefined
        : `expected topicId ${exp.autopilotTopicId ?? "null"}, got ${analysis.autopilotTopicId ?? "null"}`,
    };
  }

  if (exp.autopilotConfidence !== undefined) {
    checks.autopilotConfidence = scoreNumericRange(
      analysis.autopilotConfidence,
      exp.autopilotConfidence
    );
  }

  if (exp.escalationFlag !== undefined) {
    const pass = analysis.escalationFlag === exp.escalationFlag;
    checks.escalation = {
      pass,
      note: pass
        ? undefined
        : `expected escalationFlag=${exp.escalationFlag}, got ${analysis.escalationFlag}`,
    };
  }

  if (exp.draftShouldBeAbsent === true) {
    const pass = draft === null;
    checks.draftPresence = {
      pass,
      note: pass ? undefined : "expected no draft, but a draft was generated",
    };
  } else if (exp.draftShouldBeAbsent === false) {
    const pass = draft !== null;
    checks.draftPresence = {
      pass,
      note: pass ? undefined : "expected a draft, but none was generated",
    };
  }

  if (exp.draftMustMention && exp.draftMustMention.length > 0) {
    checks.mustMention = scoreSubstringPresence(draft, exp.draftMustMention, true);
  }

  if (exp.draftMustNotMention && exp.draftMustNotMention.length > 0) {
    checks.mustNotMention = scoreSubstringPresence(draft, exp.draftMustNotMention, false);
  }

  return checks;
}

function scoreNumericRange(
  actual: number | null,
  range: { min?: number; max?: number }
): AgentCheckResult {
  if (actual === null) {
    return { pass: false, note: "expected a confidence value, got null" };
  }
  if (range.min !== undefined && actual < range.min) {
    return { pass: false, note: `confidence ${actual} below min ${range.min}` };
  }
  if (range.max !== undefined && actual > range.max) {
    return { pass: false, note: `confidence ${actual} above max ${range.max}` };
  }
  return { pass: true };
}

function scoreSubstringPresence(
  text: string | null,
  needles: string[],
  shouldContain: boolean
): AgentCheckResult {
  if (text === null) {
    return shouldContain
      ? { pass: false, note: "no draft to check substrings against" }
      : { pass: true };
  }
  const haystack = text.toLowerCase();
  const violators: string[] = [];
  for (const needle of needles) {
    const present = haystack.includes(needle.toLowerCase());
    if (shouldContain && !present) violators.push(needle);
    if (!shouldContain && present) violators.push(needle);
  }
  if (violators.length === 0) return { pass: true };
  return {
    pass: false,
    note: shouldContain
      ? `draft missing required substrings: ${violators.join(", ")}`
      : `draft contains forbidden substrings: ${violators.join(", ")}`,
  };
}

/**
 * Convert a fixture's simplified topic spec into a full AutopilotTopicRow.
 * Defaults are sensible stubs for fields the agent pipeline doesn't read
 * during analysis (embedding, daily counters, timestamps).
 */
function toTopicRow(t: {
  id: string;
  name: string;
  description: string;
  mode: "shadow" | "auto";
  confidenceThreshold: string;
}): AutopilotTopicRow {
  return {
    id: t.id,
    orgId: "eval-org",
    name: t.name,
    description: t.description,
    embedding: null,
    mode: t.mode,
    confidenceThreshold: t.confidenceThreshold,
    dailySendLimit: 100,
    dailySendsToday: 0,
    dailySendsResetAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/** Merge core + fixture overlays by name (overlays win — same rule as loader). */
function mergeSkills(
  core: Skill[],
  overlays: { name: string; description: string; body: string }[]
): Skill[] {
  const byName = new Map<string, Skill>();
  for (const s of core) byName.set(s.name, s);
  for (const s of overlays) {
    byName.set(s.name, {
      name: s.name,
      description: s.description,
      body: s.body,
      source: "org",
    });
  }
  return Array.from(byName.values());
}
