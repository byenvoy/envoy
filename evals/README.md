# Evals

Regression harness for the LLM prompts that drive Envoy's autopilot. Run it before merging a prompt change to see whether quality moved.

## Running

```bash
# Both suites
npm run eval

# Just one
npm run eval -- draft
npm run eval -- validator

# Pick a specific generator/validator model
npm run eval -- draft --model claude-sonnet-4-6
```

Requires `ANTHROPIC_API_KEY` in `.env.local`. No database needed — the harness bypasses `createLLMProvider` and talks to the Anthropic API directly.

Exit code is 0 when every fixture passes, 1 otherwise. A JSON artifact is written to `evals/results/` per run (gitignored).

## What's covered

| Suite | Target prompt | Scoring |
|---|---|---|
| `draft` | `buildDraftPrompt` in [src/lib/rag/prompt.ts](../src/lib/rag/prompt.ts) | LLM-as-judge (Haiku) on responsiveness, grounding, scope, tone |
| `validator` | `buildValidationPrompt` in [src/lib/autopilot/prompts.ts](../src/lib/autopilot/prompts.ts) | Exact match on expected per-check verdicts and the overall auto-send decision |

The validator suite doesn't need a judge because each fixture declares the verdict a correct validator should return. That's the ground truth — we just compare.

## Fixture format

One JSON file per case, lives in `evals/fixtures/<suite>/`. Filenames are numbered (`01-…`, `02-…`) to give a stable run order.

### Draft fixture shape

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

The judge uses the rubric plus the knowledge base to grade the draft across four dimensions. `overall.pass` is true only when all four pass.

### Validator fixture shape

```jsonc
{
  "id": "...",
  "description": "...",
  "inputs": { /* customerMessage, draftContent, chunks, customerContext, ... */ },
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

Draft text is hand-crafted to exercise a specific failure mode (or a clean pass). `shouldAutoSend` captures the downstream gate behavior — all checks must pass AND confidence must clear 0.85.

## Adding a fixture

1. Copy an existing file in the relevant suite directory.
2. Keep the filename numbered — it controls run order.
3. Write a tight `description` (shows up in the terminal report).
4. For draft fixtures, think hard about the rubric:
   - `mustDo` → positive constraints the reply must satisfy.
   - `mustAvoid` → failure modes specific to this case (e.g., inventing details present only in a specific chunk).
   - `toneNote` is optional.
5. Run `npm run eval -- <suite>` to confirm it loads and the judge produces a reasonable verdict.

## Interpreting the output

```
PASS  02-order-with-context — Order status with complete customer context
      ✓ responsiveness: Addresses the shipping-status question directly.
      ✓ grounding:      Tracking number and URL match <customer_context>.
      ✓ scope:          No unilateral commitments.
      ✓ tone:           Friendly and confident.
```

- Per-check notes come from the judge (draft suite) or the validator (validator suite).
- A failed check usually points you at the exact dimension to tune in the prompt.
- Single-run results have LLM variance even at temperature=0. If a case flickers between pass/fail across runs, it's probably borderline — worth tightening the rubric or the prompt.

## What this doesn't cover yet

- The classifier, retrieval judge, topic classifier, and escalation detector prompts (easy to add — same shape as the validator suite, just different fixture schemas).
- Real anonymized conversation data — all fixtures are synthetic today.
- Regression tracking across runs (JSON artifacts are saved, but nothing diffs them).
- Non-Anthropic models (the LLM client is Anthropic-only for now).

Adding any of these is mostly plumbing on top of the existing framework.
