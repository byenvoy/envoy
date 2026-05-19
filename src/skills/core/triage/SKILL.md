---
name: triage
description: Classifies an inbound ticket, decides what context to retrieve, and plans the analysis. Apply on every ticket.
---

# Triage

Your goal in triage is to answer three questions about the ticket:
1. What category does it fall into?
2. What context do you need to handle it well?
3. Is it a candidate for autopilot or does it need a human?

## Category taxonomy

Pick exactly one category. Set it as the `category` field on `submit_analysis`.

- **order_status** — Customer is asking about an order's status, tracking, delivery, or fulfillment.
- **return_refund** — Customer wants to return an item, get a refund, or ask about return eligibility.
- **product_question** — Customer has a question about how a product works, specifications, compatibility, or availability.
- **account_issue** — Login problems, account changes, subscription issues, or other account management.
- **general_policy** — Questions about shipping, returns policy, warranty, or other general company policies not tied to a specific order.
- **other** — Anything that doesn't fit above.

## Decision flow

1. **Read the ticket carefully.** Look at the customer email, conversation history, and any attached context.
2. **Classify the category** using the taxonomy above. If ambiguous, pick the category that best represents the customer's primary intent.
3. **Decide retrieval strategy:**
   - For **order_status**, **return_refund**, **account_issue**: look up the customer's Shopify context if a Shopify integration is available. See the `shopify` skill.
   - For **product_question**, **general_policy**: search the knowledge base. See the `retrieve` skill.
   - For **other**: use judgment — often knowledge base search is enough; sometimes escalation is warranted.
4. **Gather context** by calling `search_knowledge_base` and/or `lookup_shopify_context` as needed.
5. **Apply autopilot-verdict** — read that skill and judge whether this ticket matches an autopilot topic with sufficient confidence.
6. **Apply escalation** — read that skill and judge whether any escalation red flags are present.
7. **Call `submit_analysis`** with your complete verdict and a short `draftInstructions` message guiding the draft-reply phase.

## Analysis quality

Your `draftInstructions` is how you communicate with the draft-reply phase. Keep it to 1–3 sentences but make them count:
- Note any policies that apply ("30-day return window; this order is within that.")
- Note hedges or uncertainty ("Tracking number not yet available; suggest checking back in 24 hours.")
- Note tone adjustments beyond the org default ("Customer is frustrated; lead with empathy.")

Do NOT write the actual reply text. That's the draft-reply phase's job.

## Examples

- **Ticket:** "Where's my order #1042? Was supposed to arrive yesterday."
  **→** category `order_status`. Look up Shopify. No escalation. Autopilot-eligible if a topic matches.

- **Ticket:** "Your product gave me a rash and I'm talking to my lawyer."
  **→** category `return_refund` (the underlying intent is the product complaint). Look up Shopify + knowledge base (warranty policy). `escalationFlag: true` — legal language plus safety concern overrides any autopilot match.

- **Ticket:** "I want to cancel my subscription AND get a refund for the last 3 months."
  **→** category `account_issue` (primary intent is the cancellation). Knowledge base (cancellation + refund policies). Multi-part request with a backdated refund — soft escalation, judgment call. If matching an autopilot topic, confidence should be low (~0.7) and the verdict should favor human review.
