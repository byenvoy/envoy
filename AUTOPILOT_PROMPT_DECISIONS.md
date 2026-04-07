# Autopilot Prompt Decisions

Status: **Open** | Last updated: 2026-04-03

This document captures pending decisions about the autopilot Gate 1 (topic classification) prompt in `src/lib/autopilot/prompts.ts` and its consumer `src/lib/autopilot/gates/classify-topic.ts`.

---

## Context

Gate 1 determines whether an inbound customer email should receive an autopilot (auto-sent) reply. It does this by classifying the email against a list of org-defined autopilot topics. If the email matches a topic with sufficient confidence, it proceeds through the remaining gates and may be auto-sent.

The current prompt asks the LLM to classify the email into **exactly one topic** and return a 1-based index. This has two independent problems:

1. **Index-based matching is fragile** (implementation issue)
2. **Single-topic classification may not be the right question** (design issue)

---

## Decision 1: Fix index-based topic matching

### Problem

The LLM returns a `topic_index` (1-based integer) and a `topic_name` (string). The downstream code in `classify-topic.ts:59` uses `topics[topicIndex - 1]` to look up the matched topic. If the LLM miscounts, the wrong topic is silently selected. The returned `topicName` on line 65 comes from the array (not the LLM response), so even logs would look correct — the mismatch is invisible.

`topic_name` is only used in the failure path (line 52) for logging. The actual routing is entirely index-driven.

### Proposed fix

- Switch `classify-topic.ts` to match on `parsed.topic_name` using `topics.find(t => t.name === parsed.topic_name)` instead of array index lookup.
- Remove `topic_index` from the prompt's output schema since it would no longer be needed.
- Adjust the guard clause to check `!matchedTopic` instead of checking index bounds.

### Scope

~5-6 lines changed in `classify-topic.ts`, minor prompt edit in `prompts.ts`. Low risk.

### Status

**Completed** (`53504ae`) — switched to name-based matching, removed `topic_index` from prompt.

---

## Decision 2: Classification vs. coverage analysis

### Current behavior

The prompt asks: **"Which single topic does this email belong to?"**

It forces a single classification. The matched topic's `confidenceThreshold` is used to decide pass/fail. However:

- All topics currently have the same hardcoded threshold (`0.95`, set as a DB default in `src/lib/db/schema/autopilot.ts:27`).
- There is no UI for users to configure per-topic thresholds.
- The per-topic routing is overhead that resolves to the same value every time.

### The deeper question

What we actually want to know is: **"Can the entirety of this email's requests be handled by autopilot?"**

A customer email can contain multiple intents (e.g., "Where's my order?" + "Can I get a refund?"). The current prompt forces a single-topic classification, so it either:
- Picks one intent and ignores the other, or
- Returns "none" because it can't choose

Neither is correct. If one intent is covered but another isn't, autopilot should not handle the email.

### Option A: Refine the existing classifier

Keep the single-topic classification model but fix the index fragility (Decision 1).

**Pros:**
- Smaller change, lower risk
- Current behavior is well-understood
- Works correctly for single-intent emails (which may be the majority)

**Cons:**
- Cannot correctly handle multi-intent emails
- Per-topic threshold infrastructure is unused overhead
- The prompt is answering "which topic?" when the real question is "should autopilot handle this?"

### Option B: Switch to intent coverage analysis

Replace the classification prompt with one that:
1. Extracts all distinct intents/requests from the email
2. Checks each intent against the topic list
3. Only passes if **all** intents are covered

Example output schema:
```json
{
  "intents": [
    { "intent": "asking about order shipping status", "topic": "Shipping", "covered": true },
    { "intent": "requesting refund for damaged item", "topic": "none", "covered": false }
  ],
  "all_covered": false,
  "confidence": 0.9,
  "reasoning": "Shipping question is covered but refund request is not an autopilot topic"
}
```

The gate signal becomes `all_covered && confidence >= threshold`, where threshold is a single org-level value (since per-topic thresholds are unused anyway).

**Pros:**
- Correctly models the actual decision ("can autopilot fully handle this?")
- Handles multi-intent emails
- Per-intent topic mapping gives better logging/analytics
- Simplifies threshold to a single org-level setting

**Cons:**
- Bigger change: new prompt, new response schema, new parsing logic in `classify-topic.ts`
- Intent extraction adds a layer of LLM judgment that needs testing against real emails
- May increase token usage (more structured output)
- Needs validation: are multi-intent emails common enough to justify the complexity?

### Key question to answer before deciding

Are users sending multi-intent emails often enough that single-topic classification is producing wrong gate decisions? If most emails are single-intent, Option A is sufficient. If autopilot is sending partial answers (matched one intent, missed another), Option B solves a real problem.

---

## Already completed

- Removed redundant "Only use information present in the provided knowledge base context" line from the constrained generation addendum (`38f697a`) — it conflicted with the base prompt which conditionally includes customer context.
- Added explicit closing instruction to the topic classification user prompt (`1ff3379`) — the user prompt previously had no request, just data.

---

## Resolved: scope constraints in constrained addendum

Decided **not to add** scope constraints to the generator. Commitments in drafts are fine in both paths:

- **Human review path** (majority of drafts): the commitment is a helpful starting point the agent can approve, edit, or reject.
- **Autopilot path**: Gate 4 catches commitments and routes to human review instead of auto-sending.

Constraining the generator would produce weaker drafts for the human review path with no benefit — Gate 4 already prevents commitments from being auto-sent.
