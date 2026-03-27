# Autopilot Pipeline — Current Architecture

## Pipeline Flow

```
Inbound Email
    |
    v
[process-imap.ts]
    |
    |-- Is this a reply to an auto-sent message?
    |   YES --> [Escalation Check] -- LLM detects dissatisfaction
    |           |                     Sets conversation.autopilot_disabled = true
    |           v
    |
    v
[generate-draft.ts]
    |
    |-- Is conversation.autopilot_disabled?
    |   YES --> Skip autopilot, generate normal draft
    |
    |-- Are there active autopilot topics (shadow/auto)?
    |   NO  --> Skip autopilot, generate normal draft
    |
    |-- [Gate 1: Topic Classification] -- LLM classifies email against topics
    |   |   Uses: customer message + conversation history
    |   |   Pass: confidence >= topic's threshold
    |   |
    |   FAIL --> Generate normal draft (no constrained prompt)
    |            Insert draft, run pipeline for logging only
    |
    |   PASS --> Generate draft WITH constrained prompt (Gate 3 setup)
    |
    v
[retrieveAndDraft() in retrieve.ts]
    |-- Shopify classification (existing)
    |-- Vector search (existing) --> produces message embedding
    |-- Build prompt (with or without constrained addendum)
    |-- Generate draft via LLM
    |
    v
[Strip NEEDS_HUMAN_REVIEW flag from draft_content]
    |
    v
[Insert draft into database]
    |
    v
[Autopilot Pipeline - pipeline.ts]
    |
    |-- Compute embedding similarity (using vector search embedding)
    |   Logged in gate1_embedding_similarity for future optimization
    |
    |-- [Gate 2: Retrieval Quality] -- LLM-as-judge
    |   |   Uses: customer message + KB chunks + customer context
    |   |   Pass: confidence >= 0.8
    |   |
    |   FAIL --> Log evaluation (outcome: human_queue), draft stays pending
    |
    |-- [Gate 3: Generation Escape Hatch] -- string check
    |   |   Checks: did original draft contain NEEDS_HUMAN_REVIEW flag?
    |   |   Pass: flag not present
    |   |
    |   FAIL --> Log evaluation (outcome: human_queue), draft stays pending
    |            Draft panel shows warning banner with reason
    |
    |-- [Gate 4: Post-Generation Validation] -- LLM critic
    |   |   Uses: customer message + draft + chunks + customer context
    |   |   Checks: responsiveness, accuracy, scope, completeness
    |   |   Pass: all checks pass AND confidence >= 0.85
    |   |
    |   FAIL --> Log evaluation (outcome: human_queue), draft stays pending
    |
    v
[All Gates Passed]
    |
    |-- Topic mode = shadow?
    |   YES --> Log evaluation (outcome: shadow_tagged)
    |           Draft stays pending, tagged with evaluation
    |           Human reviews, action recorded for metrics
    |
    |-- Topic mode = auto?
    |   YES --> Check daily send limit
    |           |
    |           |-- Limit exceeded? --> Treat as shadow
    |           |
    |           |-- Under limit? --> [Auto-Send]
    |               Uses existing sendReply() via auto-send.ts
    |               Log evaluation (outcome: auto_sent)
    |               Draft marked approved, sent_by_autopilot = true
```

## Key Design Decisions

### Gate 1 runs BEFORE draft generation
Gate 1 (topic classification) runs before the draft is generated so that:
- The constrained generation prompt (Gate 3) is only injected for emails matching an autopilot topic
- Emails outside autopilot topics get normal draft quality, unaffected by autopilot settings
- No extra LLM calls — Gate 1 uses Haiku, the same call that would run anyway

### Embedding similarity is computed after vector search
The cosine similarity between the customer message and topic descriptions is logged for data collection (future optimization: could the embedding pre-filter replace the LLM classification?). It's computed in the pipeline using the message embedding that the vector search already produced — no extra embedding API call needed.

### Gate 3 is tied to the constrained prompt
Gate 3 only works when the constrained generation prompt is active (Gate 1 passed). For emails that fail Gate 1, Gate 3 is skipped (gate3_passed = null). This is correct — Gate 3 is a self-assessment by the generator, which only makes sense when the generator was told to self-assess.

### Draft content is always clean
The NEEDS_HUMAN_REVIEW flag is stripped from draft_content before storage. The flag text is captured by Gate 3 and stored in gate3_needs_human_reason. The draft panel shows a warning banner when gate3_passed = false, but the draft itself is always a sendable best-effort response.

### Shadow mode data collection
Every draft that goes through the pipeline gets an autopilot_evaluations row, regardless of outcome. When a human approves or discards any draft with an evaluation:
- approved without edits → human_action = 'approved_no_edit'
- approved with edits → human_action = 'approved_with_edit' + edit_distance
- discarded/regenerated → human_action = 'discarded'

This data is collected for ALL evaluated emails (not just shadow-tagged ones), so you can assess whether each gate is too strict by comparing gate failures against human approval rates.

## LLM Calls Per Email

| Scenario | Calls | Models |
|----------|-------|--------|
| No active topics | 0 autopilot calls | — |
| Gate 1 fails | 1 | Haiku (classification) |
| Gate 1 passes, Gate 2 fails | 2 | Haiku (classification + retrieval judge) |
| Gate 1 passes, Gates 2-3 pass, Gate 4 fails | 3 | Haiku (classification + retrieval judge + validation) |
| All gates pass | 3 | Haiku (classification + retrieval judge + validation) |
| Reply to auto-sent (escalation check) | +1 | Haiku (escalation) |

Draft generation itself is always 1 call using the org's preferred model (existing, not counted above).

## Files

| File | Role |
|------|------|
| `src/lib/email/generate-draft.ts` | Orchestrator: runs Gate 1, generates draft, runs pipeline |
| `src/lib/rag/retrieve.ts` | RAG + draft generation, accepts `injectConstrainedPrompt` flag |
| `src/lib/autopilot/pipeline.ts` | Gates 2-4 + evaluation logging + auto-send decision |
| `src/lib/autopilot/gates/classify-topic.ts` | Gate 1: LLM topic classification |
| `src/lib/autopilot/gates/judge-retrieval.ts` | Gate 2: LLM retrieval quality judge |
| `src/lib/autopilot/gates/validate-draft.ts` | Gate 4: LLM draft validation critic |
| `src/lib/autopilot/auto-send.ts` | Auto-send using existing sendReply() |
| `src/lib/autopilot/escalation.ts` | Per-thread escalation detection |
| `src/lib/autopilot/prompts.ts` | All LLM prompt templates |
| `src/lib/email/process-imap.ts` | Escalation check on inbound replies |
