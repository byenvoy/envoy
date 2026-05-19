---
name: autopilot-verdict
description: Decides whether a ticket qualifies for autopilot auto-send. Produces a topic match, confidence score, and reasoning. Apply after triage on every ticket.
---

# Autopilot verdict

Autopilot topics are categories the organization has opted into for automated response. Your job is to judge whether this specific ticket matches one of the active autopilot topics and, if so, with what confidence.

## Inputs

You'll see the list of active autopilot topics in the initial user message. Each topic has:
- `name` — human-readable label (e.g., "Order Status Inquiries")
- `id` — UUID to reference in `submit_analysis.autopilotTopicId`
- `description` — detailed description of what counts as this topic
- `confidenceThreshold` — the bar this topic requires (e.g., 0.85 means you must be ≥85% confident for it to auto-send)
- `mode` — `"shadow"` (logged only) or `"auto"` (auto-sent if all gates pass)

## Decision rubric

Read each topic description carefully. Decide:

1. **Does the ticket clearly fit one of these topics?** Strict match — the customer's intent must align with the topic description, not just share keywords.
2. **What's your confidence (0.0–1.0)?**
   - **0.95+** — Unambiguous match. Ticket is a textbook example of this topic. All info needed is present.
   - **0.85–0.94** — Clear match. Minor ambiguity but the intent is obvious.
   - **0.70–0.84** — Likely match. Some uncertainty about scope or edge cases.
   - **<0.70** — Don't mark as autopilot-eligible. Set `autopilotTopicId` to null/omit.
3. **If confidence is below the topic's `confidenceThreshold`**, you can still report the match but it will not auto-send — it will queue for human review.

## What to submit

If a topic matches:
- `autopilotTopicId`: the matched topic's UUID
- `autopilotConfidence`: your score 0.0–1.0
- `autopilotReasoning`: 1–2 sentences explaining the match

If no topic matches, omit all three fields.

## Don't overmatch

Err on the side of human review. A ticket that superficially looks like a topic but has unusual elements (VIP customer, legal language, unclear intent) should NOT be marked autopilot-eligible. When in doubt, flag lower confidence or no match.

Also read the `escalation` skill — if any escalation red flags are present, they override an autopilot match. Set `escalationFlag: true` and let the system route to human.

## Examples

- **Ticket:** "Where's my order #1042?" **Active topic:** "Order Status Inquiries".
  **→** Match, confidence 0.95.

- **Ticket:** "I want to cancel my subscription AND get a refund for the last 3 months." **Active topic:** "Subscription Cancellations" (confidence threshold 0.9).
  **→** The refund request complicates it. Confidence ~0.7. No autopilot match.

- **Ticket:** "Can I return this? It broke after a week." **Active topic:** "Return Requests".
  **→** Match, but may depend on warranty. Confidence ~0.85. Flag if there's any hint of legal language.
