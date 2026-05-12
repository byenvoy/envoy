# Evals

Regression harness for Envoy's LLM-driven behavior. Run it before merging skill or prompt changes to see whether quality moved.

Two pipelines live in the codebase, and each has its own eval coverage:

| Pipeline | Used by | Eval suite(s) |
|---|---|---|
| **Agent pipeline** (skill-driven, two-phase) | Anthropic-provider orgs | [`agent`](#agent-suite) |
| **Classic pipeline** (single-shot + four gates) | Non-Anthropic-provider orgs | [`draft`](#draft-suite), [`validator`](#validator-suite) |

Both suites coexist. Run them individually, or run everything with `all`.

## Quick start

```bash
# Run all suites
npm run eval

# Run just the agent pipeline suite
npm run eval -- agent

# Run just one classic suite
npm run eval -- draft
npm run eval -- validator

# Override the model (default: claude-haiku-4-5-20251001)
npm run eval -- agent --model claude-sonnet-4-6
```

Requires `ANTHROPIC_API_KEY` in `.env.local`. No database needed — the agent suite uses `runAgentPipeline`'s override parameter to bypass DB reads, and the classic suites talk to the Anthropic API directly.

Exit code is `0` when every fixture passes, `1` otherwise. A JSON artifact lands in `evals/results/<suite>-<timestamp>.json` per run (gitignored).

## Suite overview

### Agent suite

Tests the full agent pipeline (triage agent → draft generation) end-to-end. Each fixture supplies a self-contained ticket + org-state snapshot.

**Scoring is deterministic.** Every check is either an exact match, a numeric range, or a case-insensitive substring presence/absence. No LLM-judge step — that's deferred until we have golden drafts to compare against.

What it checks (each is optional per fixture):

| Field | Type | Check |
|---|---|---|
| `category` | string | Exact match |
| `autopilotTopicId` | string \| null | Exact match (use `null` to assert "no match expected") |
| `autopilotConfidence` | `{ min?, max? }` | Falls within range |
| `escalationFlag` | boolean | Exact match |
| `draftShouldBeAbsent` | boolean | Whether a draft was generated |
| `draftMustMention` | string[] | All substrings present in draft (case-insensitive) |
| `draftMustNotMention` | string[] | No substrings present in draft (case-insensitive) |

### Draft suite (classic)

Tests `buildDraftPrompt` in [src/lib/rag/prompt.ts](../src/lib/rag/prompt.ts). LLM-as-judge (Haiku) scores responsiveness, grounding, scope, and tone.

### Validator suite (classic)

Tests `buildValidationPrompt` in [src/lib/autopilot/prompts.ts](../src/lib/autopilot/prompts.ts). Each fixture declares the verdict a correct validator should return; we compare exact match.

## Fixture format

One JSON file per case, lives in `evals/fixtures/<suite>/`. Filenames are sortable for stable run order — use a numeric prefix (`01-…`) or category prefix (`escalation-…`).

### Agent fixture shape

```jsonc
{
  "id": "...",
  "description": "Shows up in the report.",
  "labels": ["happy_path", "return_refund"],  // optional, for per-label slicing

  "input": {
    "customerEmail": "alice@example.com",
    "customerName": "Alice Chen",                   // optional
    "body": "Multi-line ticket text...",
    "conversationHistory": [                        // optional
      { "role": "customer", "content": "..." },
      { "role": "agent",    "content": "..." }
    ],
    "autopilotDisabled": false                      // optional — simulates per-thread escalation
  },

  "org": {
    "companyName": "Test Outdoor Gear",
    "autopilotTopics": [                            // optional
      {
        "id": "topic-returns-and-refunds",
        "name": "Returns & Refunds",
        "description": "What counts as this topic...",
        "mode": "auto",
        "confidenceThreshold": "0.85"
      }
    ],
    "orgSkills": [                                  // optional — overrides for voice, etc.
      {
        "name": "voice",
        "description": "...",
        "body": "# Voice and tone\n\n..."
      }
    ]
  },

  "expected": {
    "category": "return_refund",                    // any of these can be omitted
    "autopilotTopicId": "topic-returns-and-refunds",
    "autopilotConfidence": { "min": 0.80 },
    "escalationFlag": false,
    "draftShouldBeAbsent": false,
    "draftMustMention": ["#1042"],
    "draftMustNotMention": ["I've processed", "I've refunded"]
  }
}
```

**Omission is meaningful.** A fixture that omits `expected.category` doesn't get graded on category — the scorer skips it entirely. That way, fixtures can target narrow behaviors without forcing exhaustive labels.

See [`fixtures/agent/example-refund-happy-path.json`](fixtures/agent/example-refund-happy-path.json) for a working example.

### Draft fixture shape (classic)

```jsonc
{
  "id": "...",
  "description": "...",
  "inputs": { /* what buildDraftPrompt receives */ },
  "rubric": {
    "mustDo": ["Confirm the 30-day return window"],
    "mustAvoid": ["Claim the refund has been processed"],
    "toneNote": "Friendly and direct"
  }
}
```

### Validator fixture shape (classic)

```jsonc
{
  "id": "...",
  "description": "...",
  "inputs": { /* customerMessage, draftContent, chunks, customerContext */ },
  "expected": {
    "checks": {
      "responsiveness": true,
      "accuracy": false,
      "scope": false,
      "completeness": true
    },
    "shouldAutoSend": false
  }
}
```

## Writing a corpus from scratch

If you're starting with no fixtures, the suggested initial spread (~30 agent fixtures):

- **5–8 happy-path cases per category** — `order_status`, `return_refund`, `product_question`, `account_issue`, `general_policy`. These should pass cleanly.
- **8–10 escalation triggers** — legal language, chargebacks, severe frustration, VIP customers, safety mentions. Expect `escalationFlag: true`, `draftShouldBeAbsent: true`.
- **6–8 "hedge required" cases** — ticket with insufficient info, ambiguous request, contradicting context. The draft should hedge rather than fabricate.
- **4–6 autopilot edge cases** — ticket that fits a topic but has complications (cancellation + refund, return outside window). Confidence should drop or escalation fires.
- **3–5 weird-format tickets** — forwarded chains, typos, multi-language fragments, no body / subject-only.

You don't have to start with all of these. **Start with 5–10 high-signal fixtures**, run the eval, see what surfaces, iterate.

## Adding a fixture

1. Copy an existing file in `evals/fixtures/<suite>/`.
2. Pick a sortable filename (e.g., `02-refund-outside-window.json`).
3. Write a tight `description` — it appears in the report.
4. For agent fixtures:
   - Only fill `expected.*` fields for the dimensions you actually want to test.
   - `draftMustMention` is your safety net — include specific facts (`"#1042"`, `"30-day"`) the model should ground in.
   - `draftMustNotMention` catches hallucinated actions like `"I've processed"` or made-up policies.
5. Run `npm run eval -- <suite>` and verify the new fixture loads and scores as expected.

## Interpreting the output

### Agent suite output

```
PASS  01-refund-happy-path — Polite refund request within policy window.
      ✓ category
      ✓ autopilotTopic
      ✓ autopilotConfidence
      ✓ escalation
      ✓ draftPresence
      ✓ mustMention
      ✓ mustNotMention
      labels: happy_path, return_refund, autopilot_eligible

FAIL  03-vip-complaint — Long-time customer with $8K spend complaining about delayed order.
      ✓ category
      ✗ escalation: expected escalationFlag=true, got false
      labels: escalation, vip
```

Then a per-label slice and overall summary:

```
By label
  escalation: 7/10 (70%)
  happy_path: 12/12 (100%)
  vip: 2/3 (67%)

22/30 passed (73%)  4123 in / 891 out
```

When a check fails, the `note` field on the result row tells you exactly what was expected vs. actual. The full pipeline output (analysis + draft) is also saved in the JSON report for inspection.

### Classic suite output

Same shape, but the per-fixture detail comes from either the LLM judge (draft suite) or the per-check expected matrix (validator suite). See the existing fixtures and the older sections of this README for details.

## Implementation notes

### How the agent suite avoids the database

The pipeline normally reads from `org_skills`, `autopilot_topics`, and `org_api_keys`. The suite uses `runAgentPipeline`'s second argument, `AgentPipelineOverrides`, to supply:

- `skills` — built from filesystem core skills + fixture-supplied org overlays (merged by name)
- `activeTopics` — constructed from each fixture's `org.autopilotTopics`
- `apiKey` — pulled from `process.env.ANTHROPIC_API_KEY`

When all three are passed, the pipeline skips DB queries entirely. Production callers (`generate-draft-agent.ts`) pass no overrides and behavior is identical to pre-eval.

### KB retrieval and Shopify lookups

Fixtures don't currently mock the KB or Shopify integrations. The agent's `search_knowledge_base` tool will run against a fake `orgId` (none exist) and return no chunks; `lookup_shopify_context` returns the "no integration configured" error path. Both are graceful failures — the agent continues without that context.

**Practical implication:** design fixtures so their expected outcomes don't require KB content. E.g., the example fixture asks for a refund return and expects the draft to mention the order number `#1042` (supplied by the customer) but doesn't require any specific policy text. If you need to test KB-grounded responses, mocking the retrieval tool is a v2 enhancement.

### Variance

LLM responses have run-to-run variance even at low temperatures. If a fixture flickers between pass/fail across runs, that's a signal:

- The fixture's expected ranges may be too tight (loosen the `autopilotConfidence` min)
- The skill prompt may be ambiguous on that case (tune the skill content)
- The test case may be genuinely borderline (consider whether it should be testing escalation/hedge instead of a clean classification)

## What this doesn't cover yet

- **LLM-judged draft quality** for the agent suite (currently substring checks only)
- **Real anonymized conversation data** — all fixtures are synthetic
- **Cross-run regression tracking** — JSON artifacts saved, but nothing diffs them automatically
- **CI integration** — runs are manual; no PR gate yet
- **Non-Anthropic models** — eval client is Anthropic-only

Adding any of these is plumbing on top of the existing framework.
