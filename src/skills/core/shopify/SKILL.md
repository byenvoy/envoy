---
name: shopify
description: Fetches Shopify customer/order data, interprets fulfillment statuses, and handles missing integrations. Apply when a ticket asks about order status, returns, or account issues AND the org has a Shopify integration.
---

# Shopify

Use `lookup_shopify_context` to fetch a customer's profile and recent orders. Only call this when the ticket needs customer-specific data and a Shopify integration is available for the org.

## When to look up

- **Order status / tracking** — Always look up.
- **Return / refund** — Look up, so the draft-reply phase can reference the specific order.
- **Account issues** — Look up if relevant (e.g., "I never received my recent order").
- **Product questions** — Usually NOT needed — these are about the product itself, not the customer's history.
- **Policy questions** — Usually NOT needed — these are about policy text, use the knowledge base.

## Inputs

- `customerEmail` — Always pass the customer's email from the ticket headers.
- `orderIdentifier` — Only if the customer explicitly mentions an order number like "#1042". Do NOT guess.

## Handling the response

The tool returns JSON with `customer`, `recent_orders`, and `active_returns`. Shape:

```json
{
  "customer": {
    "id": "gid://shopify/Customer/8472019283746",
    "email": "alex@example.com",
    "first_name": "Alex",
    "last_name": "Chen",
    "created_at": "2024-03-15T09:12:00Z",
    "orders_count": 4,
    "total_spent": "289.5",
    "currency": "USD"
  },
  "recent_orders": [
    {
      "id": "gid://shopify/Order/5630293847562",
      "name": "#1042",
      "created_at": "2026-05-10T14:22:00Z",
      "financial_status": "PAID",
      "fulfillment_status": "FULFILLED",
      "total_price": "89.99",
      "currency": "USD",
      "line_items": [{"title": "Trail Boot", "quantity": 1, "variant_title": null}],
      "fulfillments": [{"status": "SUCCESS", "tracking_number": "1Z123", "tracking_url": "https://ups.com/track?n=1Z123", "estimated_delivery_at": null}]
    }
  ],
  "active_returns": []
}
```

Notes on the response:
- IDs are Shopify GraphQL global IDs (`gid://shopify/<Type>/<n>`). Use `name` (e.g. `#1042`) when referring to an order in a reply, not `id`.
- If `customer` is `null`, the email didn't match a known Shopify customer — the lookup succeeded but there's no profile.
- `active_returns` is currently always `[]`. The Shopify returns API doesn't yet support email-filtered queries, so this field carries no data — don't rely on it for return information.

If the response contains an `error` field instead:
- "No Shopify integration configured" → proceed without customer data, rely on the knowledge base only.
- "Shopify lookup failed" → proceed without customer data, note in `draftInstructions` that customer-specific data was unavailable.

## Interpreting order data

Enum values come back from Shopify's GraphQL Admin API in `SCREAMING_SNAKE_CASE`:

- `financial_status`: `PAID`, `PARTIALLY_PAID`, `REFUNDED`, `PARTIALLY_REFUNDED`, `VOIDED`, `PENDING`, `AUTHORIZED`, `EXPIRED`.
- `fulfillment_status`: `FULFILLED` (all items shipped), `PARTIALLY_FULFILLED` (some shipped, some not), `UNFULFILLED` (not shipped yet), `null` (no fulfillment record), plus less common values like `IN_PROGRESS`, `ON_HOLD`, `SCHEDULED`, `RESTOCKED`.
- `fulfillments[].status`: `SUCCESS`, `PENDING`, `OPEN`, `CANCELLED`, `ERROR`, `FAILURE`.
- In replies, explain these in plain language rather than quoting the Shopify status string. E.g., "your order has shipped" rather than "your order is in 'FULFILLED' status."

## Picking the right order

If the customer asks about "my order" without a specific number:
- Prefer the most recent order that matches their question (e.g., if they ask about delivery, the most recent unfulfilled or in-transit order).
- State which order you're referring to in `draftInstructions` so the draft-reply phase includes the order number/date in the reply — this lets the customer correct you if wrong.

## What NOT to do

- Never invent order numbers, tracking numbers, or dates. If a customer asks about an order we can't find, say so.
- Never promise actions the system hasn't performed — "I've processed your refund" is false unless it actually has been processed.
