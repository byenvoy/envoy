---
name: escalation
description: Detects red flags that require human escalation regardless of topic match. Overrides autopilot eligibility. Apply on every ticket after autopilot-verdict.
---

# Escalation

Some tickets must go to a human no matter what. If any of these red flags are present, set `escalationFlag: true` in `submit_analysis` and include a brief `escalationReason`.

## Hard escalation triggers

- **Legal language** — "lawyer", "attorney", "lawsuit", "legal action", "sue", "court", "discrimination claim".
- **Chargebacks / regulator mentions** — "chargeback", "dispute with my bank", "BBB", "Better Business Bureau", "FTC", "Trading Standards", state attorneys general.
- **Media / public threats** — "I'm going to post this review", "Twitter", "tweet about", "public review" tied to a complaint. (Not every mention of social media — focus on threatening/retaliatory intent.)
- **Safety / injury** — "injured", "hurt", "sick", "hospitalized", "allergic reaction", "defective product caused harm".
- **Severe dissatisfaction** — Customer is clearly frustrated or angry in a way that demands human empathy. Examples: multiple follow-ups with escalating language, all-caps rants, direct complaints about prior support.
- **Suspected fraud or account takeover** — Unauthorized charges, transactions the customer didn't make, or signs another party has access ("I didn't buy this", "someone is using my account"). Routine password resets and subscription changes are the `account_issue` category, not escalation.

## Soft escalation (judgment calls)

Use your discretion on these — when in doubt, escalate:

- **VIP customer** — If customer data shows high lifetime value (e.g., >$5K spent, or flagged as VIP). Err toward human touch.
- **Complex multi-part requests** — Ticket asks three unrelated things; probably better handled by a person.
- **Novel situation** — You genuinely don't know what the right answer is after retrieval.
- **Contradicting information** — Knowledge base says one thing, customer data says another, no clean answer.

## What to submit

If escalation is warranted:
- `escalationFlag: true`
- `escalationReason`: short description, e.g. "Legal language — customer mentioned 'speaking with my lawyer'."
- You can still submit other fields (category, etc.) for logging purposes, but `autopilotTopicId` should be omitted.

If no escalation:
- `escalationFlag: false`
- Omit `escalationReason`.

## Don't over-escalate

Routine frustration ("this is annoying", "I'm disappointed") is not a hard trigger by itself. Judge whether the tone warrants human empathy or whether a helpful auto-reply will resolve it. A polite customer asking about a late package can get autopilot treatment even if they express some frustration.

## Examples

- **Ticket:** "Your product caused an allergic reaction and I had to go to urgent care. I'm consulting with my attorney."
  **→** `escalationFlag: true`. Two hard triggers — safety/injury AND legal language. `escalationReason`: "Safety/injury and legal language — customer mentions urgent care and an attorney."

- **Ticket:** "Hi — I've been a customer for years (over 50 orders). I have three things: my last order is late, I want to update my shipping address for future orders, and can you tell me when your spring collection drops?"
  **→** `escalationFlag: true`. VIP customer (50+ orders) plus three unrelated requests — soft escalation toward human touch. `escalationReason`: "VIP customer with three-part request; better handled by a person."

- **Ticket:** "Honestly this is so annoying. My order should have been here Tuesday and it's now Friday. Can you tell me what's going on?"
  **→** `escalationFlag: false`. Routine frustration about a late order — no legal/safety/identity red flags. Autopilot-eligible if a topic matches. Note the tone in `draftInstructions` so the draft-reply phase leads with empathy.
