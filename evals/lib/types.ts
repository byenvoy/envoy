import type { ShopifyCustomerContext } from "@/lib/types/shopify";

/**
 * A single eval fixture for the draft generation suite.
 *
 * Inputs mirror what buildDraftPrompt receives in production. The rubric
 * expresses what a human reviewer would want the reply to do — the LLM judge
 * uses it to score each of the four dimensions below.
 */
export interface DraftFixture {
  id: string;
  description: string;
  inputs: {
    companyName: string;
    chunks: { content: string; sourceUrl?: string }[];
    customerMessage: string;
    conversationHistory?: { role: "customer" | "agent"; content: string }[];
    customerContext?: ShopifyCustomerContext | null;
    tone?: string;
    customInstructions?: string | null;
    greeting?: string | null;
    customerName?: string | null;
  };
  rubric: {
    /** What the reply must do (e.g., "Confirm the 30-day return window") */
    mustDo: string[];
    /** What the reply must avoid (e.g., "Claim the return has been processed") */
    mustAvoid: string[];
    /** Optional tone note (e.g., "Friendly but not saccharine") */
    toneNote?: string;
  };
}

export interface DraftJudgeVerdict {
  checks: {
    responsiveness: { pass: boolean; note: string };
    grounding: { pass: boolean; note: string };
    scope: { pass: boolean; note: string };
    tone: { pass: boolean; note: string };
  };
  overall: { pass: boolean; note: string };
}

export interface DraftResult {
  fixtureId: string;
  description: string;
  draft: string;
  verdict: DraftJudgeVerdict;
  inputTokens: number;
  outputTokens: number;
  judgeInputTokens: number;
  judgeOutputTokens: number;
}

/**
 * A single eval fixture for the draft validator (Gate 4) suite.
 *
 * The draft is hand-crafted to exercise a specific failure mode (or a clean
 * pass). The expectedChecks encode the verdict a correct validator should
 * return — we compare the model's actual verdict to this.
 */
export interface ValidatorFixture {
  id: string;
  description: string;
  inputs: {
    customerMessage: string;
    draftContent: string;
    chunks: string[];
    customerContext: string | null;
    conversationHistory?: { role: "customer" | "agent"; content: string }[];
  };
  expected: {
    checks: {
      responsiveness: boolean;
      accuracy: boolean;
      scope: boolean;
      completeness: boolean;
    };
    /** The overall pass/fail expected from the validator. Derived from
     *  (all checks pass) && confidence >= threshold, but stated explicitly here
     *  so borderline cases can be marked as expected-fails without changing the
     *  per-check matrix. */
    shouldAutoSend: boolean;
  };
}

export interface ValidatorVerdict {
  checks: {
    responsiveness: { pass: boolean; note: string };
    accuracy: { pass: boolean; note: string };
    scope: { pass: boolean; note: string };
    completeness: { pass: boolean; note: string };
  };
  confidence: number;
  reasoning: string;
}

export interface ValidatorResult {
  fixtureId: string;
  description: string;
  verdict: ValidatorVerdict;
  expected: ValidatorFixture["expected"];
  /** Per-check match: did the actual pass/fail match the expected? */
  checkMatches: {
    responsiveness: boolean;
    accuracy: boolean;
    scope: boolean;
    completeness: boolean;
  };
  /** Did the overall shouldAutoSend decision match? */
  overallMatch: boolean;
  inputTokens: number;
  outputTokens: number;
}

export interface SuiteReport<T> {
  suite: string;
  model: string;
  startedAt: string;
  finishedAt: string;
  results: T[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    totalInputTokens: number;
    totalOutputTokens: number;
  };
}

// ──────────────────────────────────────────────────────────────────────
// Agent pipeline suite — tests the full skill-driven pipeline (triage
// agent + draft generation) against fixtures with hand-labeled expected
// outcomes. Each fixture is a self-contained ticket + org-state snapshot.
// ──────────────────────────────────────────────────────────────────────

/** A simplified topic shape for fixtures. Suite expands to AutopilotTopicRow. */
export interface AgentFixtureTopic {
  id: string;
  name: string;
  description: string;
  mode: "shadow" | "auto";
  /** Confidence threshold as a decimal string, e.g. "0.85". Matches the
   *  way autopilot_topics stores numeric in the DB. */
  confidenceThreshold: string;
}

/** A simplified org-skill overlay for fixtures (e.g. voice, autopilot). */
export interface AgentFixtureSkill {
  name: string;
  description: string;
  body: string;
}

/** Optional range constraint on a numeric check (e.g. autopilotConfidence). */
export interface NumericRange {
  min?: number;
  max?: number;
}

export interface AgentFixture {
  id: string;
  description: string;
  /** Free-form labels for slicing results, e.g. ["happy_path", "vip"]. */
  labels?: string[];
  input: {
    customerEmail: string;
    customerName?: string | null;
    body: string;
    conversationHistory?: { role: "customer" | "agent"; content: string }[];
    /** Simulates per-thread escalation: agent skips autopilot topic loading. */
    autopilotDisabled?: boolean;
  };
  org: {
    companyName: string;
    /** Org-level skill overlays (e.g. voice, autopilot). Core skills
     *  still load from src/skills/core/ on the filesystem. */
    orgSkills?: AgentFixtureSkill[];
    /** Active (shadow|auto mode) autopilot topics for this org. */
    autopilotTopics?: AgentFixtureTopic[];
  };
  expected: {
    /** Exact-match category check. Omit to skip. */
    category?: string;
    /**
     * Expected autopilotTopicId. Use `null` to assert the agent should
     * NOT match any topic. Omit to skip this check.
     */
    autopilotTopicId?: string | null;
    /** Range check on autopilotConfidence. Omit to skip. */
    autopilotConfidence?: NumericRange;
    /** Expected escalationFlag. Omit to skip. */
    escalationFlag?: boolean;
    /** Substrings that must appear in the draft (case-insensitive). */
    draftMustMention?: string[];
    /** Substrings that must NOT appear in the draft (case-insensitive). */
    draftMustNotMention?: string[];
    /** If true, expect NO draft was generated (e.g. escalation path). */
    draftShouldBeAbsent?: boolean;
  };
}

/** Result of one dimension check on one fixture. */
export interface AgentCheckResult {
  pass: boolean;
  /** Explanation when pass=false. Optional when pass=true. */
  note?: string;
}

export interface AgentResult {
  fixtureId: string;
  description: string;
  labels: string[];
  /** The raw outputs from the pipeline — useful for debugging failures. */
  actual: {
    category: string | null;
    autopilotTopicId: string | null;
    autopilotConfidence: number | null;
    escalationFlag: boolean | null;
    escalationReason: string | null;
    draft: string | null;
  };
  /** Per-dimension check results. Only fields the fixture specified appear. */
  checks: {
    category?: AgentCheckResult;
    autopilotTopic?: AgentCheckResult;
    autopilotConfidence?: AgentCheckResult;
    escalation?: AgentCheckResult;
    draftPresence?: AgentCheckResult;
    mustMention?: AgentCheckResult;
    mustNotMention?: AgentCheckResult;
  };
  /** Overall pass: every configured check returned pass=true. */
  passed: boolean;
  inputTokens: number;
  outputTokens: number;
}
