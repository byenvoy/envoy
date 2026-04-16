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
