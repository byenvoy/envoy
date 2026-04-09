# Autopilot Architecture

Autopilot extends Envoy's RAG pipeline to automatically send AI-generated replies for specific email topics when confidence is high enough. It uses a four-gate confidence pipeline where failing any gate routes the draft to the human review queue.

## Overview

- **Two modes:** Shadow (logs what would be sent, but leaves draft for human review) and Auto (sends automatically)
- **User-defined topics:** Users describe topics in natural language. The system classifies inbound emails against these topics.
- **Fail-safe:** Every gate failure routes to human review. The draft is always generated regardless of autopilot outcome.
- **Per-thread escalation:** If a customer replies negatively to an auto-sent message, autopilot is disabled for that thread.

## Pipeline Flow

```
Inbound Email
    |
    v
[Escalation Check] -- if reply to auto-sent msg, detect dissatisfaction
    |
    v
[Existing Pipeline] -- classify, vector search, generate draft, insert draft
    |                   (draft always created, always visible in inbox)
    |
    v
[Gate 1: Topic Classification] -- LLM classifies email against user-defined topics
    |--- FAIL ---> Draft stays pending (normal flow)
    v
[Gate 2: Retrieval Quality] -- LLM-as-judge: are the KB chunks sufficient?
    |--- FAIL ---> Draft stays pending
    v
[Gate 3: Generation Escape Hatch] -- check draft for NEEDS_HUMAN_REVIEW flag
    |--- FAIL ---> Draft stays pending
    v
[Gate 4: Post-Generation Validation] -- separate LLM critic evaluates draft
    |--- FAIL ---> Draft stays pending
    v
[Mode Check] -- shadow: tag draft / auto: send via SMTP
```

## Database Schema

### `autopilot_topics`

User-defined categories eligible for auto-send.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `org_id` | uuid | FK to organizations, with RLS |
| `name` | text | Human-readable topic name (e.g., "Shipping status inquiries") |
| `description` | text | Natural language description used for LLM classification |
| `embedding` | vector(1536) | Pre-computed embedding of description (for future pre-filter optimization) |
| `mode` | text | 'off', 'shadow', or 'auto' |
| `confidence_threshold` | numeric | Minimum LLM classification confidence to pass Gate 1 (default 0.95) |
| `daily_send_limit` | integer | Maximum auto-sends per day for this topic (default 100) |
| `daily_sends_today` | integer | Counter reset daily |
| `daily_sends_reset_at` | timestamptz | When the daily counter was last reset |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### `autopilot_evaluations`

Audit log for every autopilot pipeline run. One row per evaluated email.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `org_id` | uuid | FK to organizations |
| `conversation_id` | uuid | FK to conversations |
| `draft_id` | uuid | FK to drafts |
| **Gate 1** | | |
| `gate1_passed` | boolean | Did the email match an active topic? |
| `gate1_topic_id` | uuid | FK to matched autopilot_topic |
| `gate1_topic_name` | text | Snapshot of topic name at evaluation time |
| `gate1_confidence` | numeric | LLM classification confidence (0-1) |
| `gate1_embedding_similarity` | numeric | Cosine similarity between email and topic embeddings (logged, not used as filter) |
| `gate1_reasoning` | text | LLM classification reasoning |
| **Gate 2** | | |
| `gate2_passed` | boolean | Is the retrieved KB context sufficient? |
| `gate2_confidence` | numeric | Judge confidence (0-1) |
| `gate2_reasoning` | text | Judge reasoning |
| **Gate 3** | | |
| `gate3_passed` | boolean | Did the draft avoid NEEDS_HUMAN_REVIEW? |
| `gate3_needs_human_reason` | text | Reason from the flag, if triggered |
| **Gate 4** | | |
| `gate4_passed` | boolean | Did the draft pass all validation checks? |
| `gate4_confidence` | numeric | Validator confidence (0-1) |
| `gate4_checks` | jsonb | Per-check results: { responsiveness, accuracy, scope, tone, completeness } |
| `gate4_reasoning` | text | Validator reasoning |
| **Outcome** | | |
| `all_gates_passed` | boolean | True if all four gates passed |
| `outcome` | text | 'auto_sent', 'shadow_tagged', or 'human_queue' |
| `failure_gate` | integer | 1-4, which gate failed first (null if all passed) |
| **Shadow Tracking** | | |
| `human_action` | text | 'approved_no_edit', 'approved_with_edit', 'discarded' (populated when human reviews) |
| `edit_distance` | integer | Word-level Levenshtein distance between original and edited draft |
| `created_at` | timestamptz | |

### Columns Added to Existing Tables

**conversations:**
- `autopilot_disabled boolean default false` -- per-thread escalation flag. Set to true when escalation is detected.

**drafts:**
- `autopilot_evaluation_id uuid` -- FK to autopilot_evaluations. Links the draft to its pipeline run.
- `sent_by_autopilot boolean default false` -- True if the draft was auto-sent by the pipeline.

**usage_logs:**
- `call_type` expanded to include: 'autopilot_classify', 'autopilot_retrieval_judge', 'autopilot_validate', 'autopilot_escalation'

## Gate Details

### Gate 1: Topic Classification

**File:** `src/lib/autopilot/gates/classify-topic.ts`

- **Embedding similarity** (logged, not used as filter): Computes cosine similarity between the message embedding (already generated for RAG) and each topic's stored embedding. Logged in `gate1_embedding_similarity` for future optimization.
- **LLM classification:** Haiku call listing all active topics with descriptions. Returns matched topic index, confidence, and reasoning.
- **Pass condition:** Confidence >= topic's `confidence_threshold`
- **Cost:** 1 Haiku call per email

### Gate 2: Retrieval Quality

**File:** `src/lib/autopilot/gates/judge-retrieval.ts`

- **LLM-as-judge:** Receives customer message + retrieved KB chunks. Evaluates whether the context is sufficient to fully answer.
- **Pass condition:** `sufficient === true` AND `confidence >= 0.8`
- **Cost:** 1 Haiku call

### Gate 3: Generation Escape Hatch

**No separate file** -- checked in `src/lib/autopilot/pipeline.ts`

- **How it works:** When autopilot topics are active, the draft generation prompt includes a constraint telling the LLM to output `NEEDS_HUMAN_REVIEW: [reason]` instead of a partial answer if it can't fully respond from context.
- **Prompt injection:** `src/lib/autopilot/prompts.ts` > `getConstrainedGenerationAddendum()`, appended to `customInstructions` in `src/lib/rag/retrieve.ts`
- **Pass condition:** Draft does not contain the `NEEDS_HUMAN_REVIEW` flag
- **Cost:** Zero (prompt modification to existing generation call)

### Gate 4: Post-Generation Validation

**File:** `src/lib/autopilot/gates/validate-draft.ts`

- **Separate LLM call** with a critic prompt (not the same call that generated the draft)
- **Evaluates five criteria:** responsiveness, accuracy, scope boundaries, tone, completeness
- **Pass condition:** ALL individual checks pass AND overall confidence >= 0.85
- **Cost:** 1 Haiku call

## Auto-Send Mechanism

**File:** `src/lib/autopilot/auto-send.ts`

Mirrors the manual approve flow (`src/app/api/conversations/[id]/approve/route.ts`):

1. Fetches conversation, latest inbound message, email connection, email address
2. Calls `sendReply()` from `src/lib/email/send-reply.ts` (same SMTP function as manual sends)
3. Updates draft: `status='approved'`, `sent_by_autopilot=true`, `approved_by=null`
4. Atomically increments the topic's `daily_sends_today`

## Escalation Logic

**File:** `src/lib/autopilot/escalation.ts`

When a customer replies to an auto-sent message:
1. `process-imap.ts` checks if the conversation's last approved draft was `sent_by_autopilot`
2. If so, runs a Haiku LLM call to detect dissatisfaction, confusion, or escalation signals
3. If detected, sets `conversations.autopilot_disabled = true`
4. All future emails in that thread bypass autopilot entirely

On failure, defaults to escalating (safe side).

## Shadow Mode

Shadow mode runs the full four-gate pipeline but does not send. The draft is tagged with `autopilot_evaluation_id` and stays pending in the inbox.

**Data collection:** When a human reviews a shadow-tagged draft:
- **Approve without edit:** `human_action = 'approved_no_edit'`
- **Approve with edit:** `human_action = 'approved_with_edit'`, `edit_distance` computed as word-level Levenshtein
- **Discard:** `human_action = 'discarded'`

**Key metric:** `approved_no_edit / (approved_no_edit + approved_with_edit + discarded)` per topic.

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/autopilot/topics` | List org's topics |
| POST | `/api/autopilot/topics` | Create topic (embeds description) |
| PUT | `/api/autopilot/topics/[id]` | Update topic (re-embeds if description changed) |
| DELETE | `/api/autopilot/topics/[id]` | Delete topic |
| GET | `/api/autopilot/metrics` | Shadow mode metrics per topic (30-day window) |

All endpoints require authentication, owner role, and scope to `org_id`.

## Configuration

Users control per topic:
- **Name:** Human-readable label
- **Description:** Natural language description for classification
- **Mode:** Off / Shadow / Auto
- **Confidence threshold:** Minimum classification confidence (default 0.95)
- **Daily send limit:** Maximum auto-sends per day (default 100)

## File Map

| File | Purpose |
|------|---------|
| `supabase/migrations/014_autopilot.sql` | Database schema |
| `src/lib/autopilot/types.ts` | TypeScript types for pipeline |
| `src/lib/autopilot/prompts.ts` | LLM prompt templates for all gates |
| `src/lib/autopilot/pipeline.ts` | Main four-gate orchestrator |
| `src/lib/autopilot/auto-send.ts` | Auto-send using existing sendReply |
| `src/lib/autopilot/escalation.ts` | Per-thread escalation detection |
| `src/lib/autopilot/gates/classify-topic.ts` | Gate 1: Topic classification |
| `src/lib/autopilot/gates/judge-retrieval.ts` | Gate 2: Retrieval quality |
| `src/lib/autopilot/gates/validate-draft.ts` | Gate 4: Draft validation |
| `src/app/api/autopilot/topics/route.ts` | Topic list + create API |
| `src/app/api/autopilot/topics/[id]/route.ts` | Topic update + delete API |
| `src/app/api/autopilot/metrics/route.ts` | Metrics API |
| `src/app/(dashboard)/autopilot/page.tsx` | Autopilot settings page |
| `src/components/autopilot/topic-list.tsx` | Topic management UI |
| `src/components/autopilot/topic-metrics.tsx` | Metrics dashboard |
| `src/components/inbox/autopilot-badge.tsx` | Inbox draft badge |

## LLM Cost per Email

| Call | Gate | Model | When |
|------|------|-------|------|
| Topic classification | Gate 1 | Haiku | Every email with active topics |
| Retrieval judge | Gate 2 | Haiku | Only if Gate 1 passes |
| Draft generation | Gate 3 | Org's preferred model | Always (existing, prompt modified) |
| Draft validation | Gate 4 | Haiku | Only if Gate 3 passes |
| Escalation check | N/A | Haiku | Only on replies to auto-sent messages |

Early gate failures short-circuit: an email failing Gate 1 costs only 1 Haiku call.
