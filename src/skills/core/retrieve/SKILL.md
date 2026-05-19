---
name: retrieve
description: Searches the knowledge base for grounded policy/product information. Covers query formulation, multiple-search patterns, and when to skip retrieval. Apply when a ticket needs facts beyond customer-specific data.
---

# Retrieve

Use `search_knowledge_base` to find grounded information in the organization's documentation.

## When to search

- **Policy questions** — "What's your return policy?", "How does warranty work?"
- **Product questions** — "Is this compatible with X?", "How do I use feature Y?"
- **Anything you'd otherwise answer from memory** — If you'd be tempted to write a fact without a source, search for it first.

## When NOT to search

- **Pure Shopify lookups** — "Where's my order?" with no product/policy question. Use `lookup_shopify_context` instead.
- **Obvious thanks / acknowledgments** — "Thanks, got it!" doesn't need retrieval.
- **When the knowledge base clearly won't have it** — Personal account details, order-specific data.

## Query formulation

Phrase the query like the information you need, not like the customer's question. Good:

- `"return policy window days"` (looking for policy facts)
- `"shipping delivery time estimates"` (looking for SLA info)
- `"warranty coverage electronics"` (looking for warranty terms)

Avoid:
- `"can I return this?"` (too conversational — will match less well)
- `"customer wants refund"` (describes the ticket, not the info)

## Multiple searches

When a ticket spans multiple topics, run a separate query for each. Each call returns its own chunks; results accumulate (see "Reading results" below). Worked example:

- **Ticket:** "My order is 5 days late and I want a refund if it doesn't arrive soon."
- **Search 1:** `"shipping delay policy late delivery"` — looking for the SLA and what counts as late.
- **Search 2:** `"refund eligibility late delivery"` — looking for whether late shipping qualifies for a refund.

Stop once new searches stop adding relevant chunks — diminishing returns wastes tokens.

## Reading results

The tool returns chunks with `similarity` scores (0–1, higher is better), `source` (URL or title), and `content`. Chunks below similarity 0.3 are filtered out automatically.

If results look irrelevant, either:
- Try a different query, or
- Accept that the knowledge base doesn't cover this topic and note it in `draftInstructions` so the draft-reply phase can hedge.

All retrieved chunks accumulate across calls and are automatically available to the draft-reply phase — you don't need to pass them anywhere, and you don't need to re-search for chunks you've already retrieved.
