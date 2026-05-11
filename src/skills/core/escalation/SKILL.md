---
name: escalation
description: Red flags that require human escalation regardless of topic match. Overrides autopilot eligibility when triggered.
---

# Escalation

Some tickets must go to a human no matter what. If any of these red flags are present, set `escalationFlag: true` in `submit_analysis` and include a brief `escalationReason`.

## Hard escalation triggers

- **Legal language** — "lawyer", "attorney", "lawsuit", "legal action", "sue", "court", "discrimination claim".
- **Chargebacks / regulator mentions** — "chargeback", "dispute with my bank", "BBB", "Better Business Bureau", "FTC", "Trading Standards", state attorneys general.
- **Media / public threats** — "I'm going to post this review", "Twitter", "tweet about", "public review" tied to a complaint. (Not every mention of social media — focus on threatening/retaliatory intent.)
- **Safety / injury** — "injured", "hurt", "sick", "hospitalized", "allergic reaction", "defective product caused harm".
- **Severe dissatisfaction** — Customer is clearly frustrated or angry in a way that demands human empathy. Examples: multiple follow-ups with escalating language, all-caps rants, direct complaints about prior support.
- **Wrong customer / identity concerns** — Customer can't access their account, suspects fraud, mentions unauthorized charges.

## Soft escalation (judgment calls)

Use your discretion on these — when in doubt, escalate:

- **VIP customer** — If customer data shows high lifetime value (e.g., >$5K spent, or flagged as VIP). Err toward human touch.
- **Complex multi-part requests** — Ticket asks three unrelated things; probably better handled by a person.
- **Novel situation** — You genuinely don't know what the right answer is after retrieval.
- **Contradicting information** — KB says one thing, customer data says another, no clean answer.

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
