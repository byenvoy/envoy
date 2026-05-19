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

It's fine to call `search_knowledge_base` 2–3 times with different queries if the ticket spans topics. For example:
- Ticket about a late order that might need a refund → search for "shipping delays" AND "refund policy"

Don't exceed ~4 searches per ticket — diminishing returns and wastes tokens.

## Reading results

The tool returns chunks with `similarity` scores (0–1, higher is better), `source` (URL or title), and `content`. Chunks below similarity 0.3 are filtered out automatically.

If results look irrelevant, either:
- Try a different query, or
- Accept that the knowledge base doesn't cover this topic and note it in `draftInstructions` so the draft-reply phase can hedge.

All retrieved chunks are automatically available to the draft-reply phase — you don't need to pass them anywhere. Just retrieve what's needed for the answer.
