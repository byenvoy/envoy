# Autopilot Feature: Architecture & Implementation Guide

## Overview

This document describes the architecture for an autopilot feature built on top of an existing RAG-based customer service email pipeline. The base pipeline receives inbound customer emails, retrieves relevant resources from a knowledge base via RAG, and generates a draft response for human review. The autopilot feature extends this by allowing certain categories of emails to be automatically sent without human approval, subject to a series of quality and safety gates.

The core design principle is a **confidence-gated pipeline**: an email is only auto-sent if it passes every gate in the chain. Failing any single gate routes the draft to the human review queue. The philosophy is simple -- when in doubt, don't send.

---

## Pipeline Architecture

The autopilot pipeline consists of four sequential gates. Each gate has a pass condition and a fail-safe path that routes the email back to the human queue.

```
Inbound Email
    |
    v
[Gate 1: Topic Classification]
    |--- FAIL ---> Human Queue
    |
    v (PASS)
[Gate 2: Retrieval Quality Check]
    |--- FAIL ---> Human Queue
    |
    v (PASS)
[Gate 3: Constrained Draft Generation]
    |--- NEEDS_HUMAN_REVIEW flag ---> Human Queue
    |
    v (PASS)
[Gate 4: Post-Generation Validation]
    |--- FAIL ---> Human Queue
    |
    v (PASS)
Auto-Send
```

---

## Gate 1: Topic Classification

### Purpose

Determine whether the inbound email falls within a user-defined autopilot-eligible topic category. This is the first and cheapest filter.

### Implementation

Use an LLM call (a fast, inexpensive model like Claude Haiku is sufficient) with a system prompt that classifies the email into one of the user's predefined categories. The model should return structured JSON containing the matched category and a confidence score.

### Pass Condition

- The email matches an autopilot-enabled category.
- The classification confidence score exceeds a high threshold (recommended: >0.95).

### Fail Behavior

Any email that does not match an enabled category, or matches with confidence below the threshold, is routed to the human review queue.

### User Configuration

The user defines which topic categories are eligible for autopilot. Example configuration:

- **Autopilot enabled:** Shipping status inquiries, password reset requests, refund policy questions.
- **Human review required:** Cancellation requests, billing disputes, account security issues.

---

## Gate 2: Retrieval Quality Check

### Purpose

Evaluate whether the RAG retrieval returned sufficiently relevant context to generate a reliable response. If the retriever pulled back low-relevance chunks, the generated response is likely to hallucinate or be vague, and should not be auto-sent.

### Implementation

There are two approaches, which can be used independently or together:

1. **Relevance score threshold:** Check the similarity scores (cosine similarity or equivalent) returned by the vector database. If the top retrieved chunks fall below a minimum relevance threshold, the retrieval is considered insufficient.

2. **LLM-as-judge (recommended):** Make a separate LLM call that receives the inbound email and the retrieved context, then answers: "Does this context contain sufficient information to fully answer this customer's question?" The model returns a binary yes/no judgment with a confidence score.

### Pass Condition

- Retrieved chunks meet the minimum relevance score threshold, AND/OR
- The LLM judge confirms the context is sufficient with high confidence.

### Fail Behavior

Insufficient retrieval quality routes the email to the human review queue.

---

## Gate 3: Constrained Draft Generation

### Purpose

Generate the response draft with a system prompt that is more constrained than the standard draft-generation prompt, building in an explicit escape hatch for uncertain cases.

### Implementation

The generation system prompt should include the following constraints:

- Only use information present in the provided context.
- Do not speculate or infer information not explicitly stated in the retrieved documents.
- If you cannot fully answer the customer's question from the provided context, do not attempt a partial answer. Instead, return the flag `NEEDS_HUMAN_REVIEW` along with a brief explanation of what information is missing.

### Pass Condition

- The model generates a complete draft without triggering the `NEEDS_HUMAN_REVIEW` flag.

### Fail Behavior

Any draft containing the `NEEDS_HUMAN_REVIEW` flag is routed to the human review queue along with the model's explanation of what was missing.

---

## Gate 4: Post-Generation Validation

### Purpose

Run the generated draft through a separate validation step as a final safety net before sending. This is a distinct LLM call from the generation step, with a different system prompt focused on critical evaluation rather than helpful generation.

### Why a Separate Call

Using a separate API call (not the same call that generated the draft) avoids the self-evaluation bias where a model is inclined to defend its own output. The generation call and the validation call have fundamentally different jobs:

- **Generator prompt:** "Write a helpful response using this context."
- **Validator prompt:** "Critically evaluate whether this draft is accurate, complete, and safe to send."

The validator does not need to be a different model, though using a more capable model for validation than for generation is a valid pattern (e.g., generate with Haiku, validate with Sonnet).

### Validation Checks

The validator should evaluate the draft against the following criteria:

- **Responsiveness:** Does the draft actually address what the customer asked?
- **Accuracy:** Does the draft contain any information not supported by the retrieved context (hallucinated order numbers, dates, policies, etc.)?
- **Scope boundaries:** Does the draft make any promises or commitments that should not be automated (refunds above a certain dollar amount, SLA guarantees, legal-adjacent language)?
- **Tone:** Is the tone appropriate for the customer's situation and the brand voice?
- **Completeness:** Does the draft fully resolve the customer's inquiry, or does it leave open questions?

### Pass Condition

- The validator returns a pass judgment with confidence above the threshold.

### Fail Behavior

Any draft that fails validation is routed to the human review queue, along with the validator's reasoning for the failure.

---

## Shadow Mode: Pre-Launch Validation

### Purpose

Before enabling autopilot for live email sending, the system should run in shadow mode to gather empirical data on pipeline performance. Shadow mode runs the full autopilot pipeline on every inbound email but does not actually send any responses. Instead, it flags what the system *would* have auto-sent and allows comparison against what the human reviewer actually approved.

### How It Works

1. Every inbound email passes through the full four-gate autopilot pipeline.
2. Emails that pass all four gates are flagged as "autopilot-eligible" but are still routed to the human review queue for manual approval.
3. The system records the autopilot decision (would-send vs. would-not-send) alongside the human reviewer's action (approved as-is, approved with edits, rejected/rewritten).

### Key Metrics

The following metrics should be tracked during the shadow period, segmented by topic category:

- **Approved-without-edits rate:** The percentage of autopilot-eligible drafts that the human reviewer approved without making any changes. This is the headline metric because it directly measures whether the autopilot output would have been good enough to send as-is.

- **Edit distance on modified drafts:** For drafts that were edited before sending, measure the magnitude of the changes. A one-word tweak is qualitatively different from a full rewrite. Small edits may still indicate acceptable autopilot quality depending on the user's tolerance, while heavy rewrites indicate the pipeline is fundamentally missing something for that category.

- **Gate pass/fail rates:** What percentage of emails pass each checkpoint. This identifies bottlenecks (e.g., if Gate 2 is rejecting 80% of emails, retrieval quality may need improvement).

- **False positive rate:** Bad emails that passed all gates and would have been auto-sent (identified by human rejection or heavy editing during shadow mode).

- **False negative rate:** Good emails that were unnecessarily routed to humans (identified by no-edit approvals on emails that failed a gate).

### Determining Readiness

The system should remain in shadow mode until sufficient data has been gathered to evaluate performance with statistical confidence. Readiness criteria include:

- A minimum volume of emails processed per topic category (enough to be statistically meaningful for that category's volume).
- The approved-without-edits rate meets the user's defined threshold for each enabled topic category.
- The false positive rate (bad auto-sends) is at or near zero.

Different topic categories may reach readiness at different times. The system should support enabling autopilot on a per-category basis as each one meets the threshold.

### User-Defined Thresholds

Different businesses will have different quality tolerances:

- A high-volume e-commerce support desk prioritizing speed might accept a 90% no-edit rate.
- A B2B SaaS company with enterprise clients might require 98%+.

The configuration UI should surface per-category shadow mode metrics and let the user decide which categories to activate.

---

## Escape Hatches & Safety Mechanisms

### Per-Thread Escalation

If a customer replies to an auto-sent email with language suggesting dissatisfaction, confusion, or a desire to escalate, that entire thread should be immediately flagged for human review going forward, regardless of topic classification. Subsequent messages in that thread should bypass autopilot entirely.

### Per-Customer Escalation

Optionally, if a customer has triggered escalation on multiple threads, all future emails from that customer can be routed to human review by default.

### Dollar/Impact Thresholds

Certain actions should never be automated regardless of topic classification. Examples include refunds above a configurable dollar amount, account closures, legal or compliance-related responses, and any response that references specific contractual terms.

---

## Cost & Latency Considerations

The autopilot pipeline requires 3-4 LLM calls per inbound email:

| Call | Purpose | Recommended Model | Relative Cost |
|---|---|---|---|
| Topic Classifier | Gate 1 | Haiku (fast/cheap) | Low |
| Retrieval Validator | Gate 2 | Haiku | Low |
| Draft Generator | Gate 3 | Sonnet (or current generation model) | Medium |
| Post-Generation Validator | Gate 4 | Haiku or Sonnet | Low-Medium |

For emails that fail early gates (e.g., topic classification), only one LLM call is made before routing to the human queue, keeping costs minimal for non-autopilot traffic.

---

## Logging & Observability

Every gate decision should be logged with:

- The inbound email ID and timestamp.
- The gate that was evaluated.
- The pass/fail decision and confidence score.
- The model used and the latency of the call.
- For Gate 4, the specific validation checks and their individual results.

This data feeds both the shadow mode analysis and ongoing production monitoring after autopilot is enabled. Dashboards should surface trends in gate pass rates, auto-send volumes, and any post-send escalations that indicate a quality regression.