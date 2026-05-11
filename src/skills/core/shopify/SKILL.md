---
name: shopify
description: How to use Shopify customer/order data. Covers when to look up, how to handle missing integrations, and how to interpret fulfillment statuses.
---

# Shopify

Use `lookup_shopify_context` to fetch a customer's profile and recent orders. Only call this when the ticket needs customer-specific data and a Shopify integration is available for the org.

## When to look up

- **Order status / tracking** — Always look up.
- **Return / refund** — Look up, so the drafter can reference the specific order.
- **Account issues** — Look up if relevant (e.g., "I never received my recent order").
- **Product questions** — Usually NOT needed — these are about the product itself, not the customer's history.
- **Policy questions** — Usually NOT needed — these are about policy text, use KB.

## Inputs

- `customerEmail` — Always pass the customer's email from the ticket headers.
- `orderIdentifier` — Only if the customer explicitly mentions an order number like "#1042". Do NOT guess.

## Handling the response

The tool returns JSON with `customer`, `recent_orders`, and `active_returns`. If it returns an `error` field:
- "No Shopify integration configured" → proceed without customer data, rely on KB only.
- "Shopify lookup failed" → proceed without customer data, note in `draftInstructions` that customer-specific data was unavailable.

## Interpreting order data

- `financial_status`: `paid`, `partially_paid`, `refunded`, `voided`, `pending`, `authorized`.
- `fulfillment_status`: `fulfilled` (all items shipped), `partially_fulfilled` (some shipped, some not), `unfulfilled` (not shipped yet), `null` (no fulfillment record).
- In replies, explain these in plain language rather than quoting the Shopify status string. E.g., "your order has shipped" rather than "your order is in 'fulfilled' status."

## Picking the right order

If the customer asks about "my order" without a specific number:
- Prefer the most recent order that matches their question (e.g., if they ask about delivery, the most recent unfulfilled or in-transit order).
- State which order you're referring to in `draftInstructions` so the drafter includes the order number/date in the reply — this lets the customer correct you if wrong.

## What NOT to do

- Never invent order numbers, tracking numbers, or dates. If a customer asks about an order we can't find, say so.
- Never promise actions the system hasn't performed — "I've processed your refund" is false unless it actually has been processed.
