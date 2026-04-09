-- =============================================================
-- Autopilot Performance Analysis Queries
-- Run these against your Postgres database to evaluate whether
-- autopilot topics are ready to activate (shadow -> auto mode).
-- =============================================================

-- ---------------------------------------------------------
-- 1. OVERVIEW: All topics with evaluation counts and pass rates
-- ---------------------------------------------------------
SELECT
  t.name AS topic,
  t.mode,
  o.name AS org,
  COUNT(e.id) AS total_evaluations,
  COUNT(e.id) FILTER (WHERE e.all_gates_passed) AS all_passed,
  ROUND(
    100.0 * COUNT(e.id) FILTER (WHERE e.all_gates_passed) / NULLIF(COUNT(e.id), 0), 1
  ) AS pass_rate_pct,
  COUNT(e.id) FILTER (WHERE e.failure_gate = 1) AS failed_gate1,
  COUNT(e.id) FILTER (WHERE e.failure_gate = 2) AS failed_gate2,
  COUNT(e.id) FILTER (WHERE e.failure_gate = 3) AS failed_gate3,
  COUNT(e.id) FILTER (WHERE e.failure_gate = 4) AS failed_gate4
FROM autopilot_topics t
JOIN organizations o ON o.id = t.org_id
LEFT JOIN autopilot_evaluations e ON e.gate1_topic_id = t.id
WHERE t.mode IN ('shadow', 'auto')
GROUP BY t.id, t.name, t.mode, o.name
ORDER BY o.name, t.name;

-- ---------------------------------------------------------
-- 2. HUMAN ACTIONS on shadow-mode drafts
--    Shows how agents handle drafts that autopilot would have sent.
--    "approved" without edits = autopilot would have been correct.
-- ---------------------------------------------------------
SELECT
  t.name AS topic,
  o.name AS org,
  COUNT(e.id) AS total,
  COUNT(e.id) FILTER (WHERE e.human_action = 'approved') AS approved,
  COUNT(e.id) FILTER (WHERE e.human_action = 'approved' AND (e.edit_distance IS NULL OR e.edit_distance = 0)) AS approved_no_edits,
  COUNT(e.id) FILTER (WHERE e.human_action = 'approved' AND e.edit_distance > 0) AS approved_with_edits,
  COUNT(e.id) FILTER (WHERE e.human_action = 'discarded') AS discarded,
  COUNT(e.id) FILTER (WHERE e.human_action IS NULL) AS pending,
  ROUND(
    100.0 * COUNT(e.id) FILTER (WHERE e.human_action = 'approved' AND (e.edit_distance IS NULL OR e.edit_distance = 0))
    / NULLIF(COUNT(e.id) FILTER (WHERE e.human_action IS NOT NULL), 0), 1
  ) AS approved_no_edit_rate_pct
FROM autopilot_evaluations e
JOIN autopilot_topics t ON t.id = e.gate1_topic_id
JOIN organizations o ON o.id = e.org_id
WHERE e.all_gates_passed = true
GROUP BY t.id, t.name, o.name
ORDER BY o.name, t.name;

-- ---------------------------------------------------------
-- 3. GATE CONFIDENCE DISTRIBUTIONS per topic
--    Check if confidence scores are stable or wildly fluctuating.
-- ---------------------------------------------------------
SELECT
  t.name AS topic,
  o.name AS org,
  -- Gate 1: Topic classification
  ROUND(AVG(e.gate1_confidence::numeric), 3) AS g1_avg_conf,
  ROUND(MIN(e.gate1_confidence::numeric), 3) AS g1_min_conf,
  ROUND(MAX(e.gate1_confidence::numeric), 3) AS g1_max_conf,
  -- Gate 2: Retrieval quality
  ROUND(AVG(e.gate2_confidence::numeric), 3) AS g2_avg_conf,
  ROUND(MIN(e.gate2_confidence::numeric), 3) AS g2_min_conf,
  -- Gate 4: Post-generation validation
  ROUND(AVG(e.gate4_confidence::numeric), 3) AS g4_avg_conf,
  ROUND(MIN(e.gate4_confidence::numeric), 3) AS g4_min_conf
FROM autopilot_evaluations e
JOIN autopilot_topics t ON t.id = e.gate1_topic_id
JOIN organizations o ON o.id = e.org_id
GROUP BY t.id, t.name, o.name
ORDER BY o.name, t.name;

-- ---------------------------------------------------------
-- 4. FAILURE REASONS: Why drafts are failing each gate
--    Useful for tuning prompts or KB coverage.
-- ---------------------------------------------------------

-- Gate 1 failures (topic not matched or low confidence)
SELECT
  t.name AS topic,
  e.gate1_reasoning,
  e.gate1_confidence,
  COUNT(*) AS occurrences
FROM autopilot_evaluations e
JOIN autopilot_topics t ON t.id = e.gate1_topic_id
WHERE e.gate1_passed = false
GROUP BY t.name, e.gate1_reasoning, e.gate1_confidence
ORDER BY occurrences DESC
LIMIT 20;

-- Gate 3 failures (LLM flagged NEEDS_HUMAN_REVIEW)
SELECT
  t.name AS topic,
  e.gate3_needs_human_reason,
  COUNT(*) AS occurrences
FROM autopilot_evaluations e
JOIN autopilot_topics t ON t.id = e.gate1_topic_id
WHERE e.gate3_passed = false
GROUP BY t.name, e.gate3_needs_human_reason
ORDER BY occurrences DESC
LIMIT 20;

-- ---------------------------------------------------------
-- 5. DAILY TREND: Pass rate over time per topic
--    Look for stability before activating.
-- ---------------------------------------------------------
SELECT
  t.name AS topic,
  DATE(e.created_at) AS day,
  COUNT(e.id) AS evaluations,
  COUNT(e.id) FILTER (WHERE e.all_gates_passed) AS passed,
  ROUND(
    100.0 * COUNT(e.id) FILTER (WHERE e.all_gates_passed) / NULLIF(COUNT(e.id), 0), 1
  ) AS pass_rate_pct
FROM autopilot_evaluations e
JOIN autopilot_topics t ON t.id = e.gate1_topic_id
GROUP BY t.id, t.name, DATE(e.created_at)
ORDER BY t.name, day;

-- ---------------------------------------------------------
-- 6. ESCALATION CHECK: Conversations where autopilot was disabled
--    High escalation count on a topic = not ready for auto mode.
-- ---------------------------------------------------------
SELECT
  t.name AS topic,
  o.name AS org,
  COUNT(DISTINCT c.id) AS escalated_conversations
FROM conversations c
JOIN autopilot_evaluations e ON e.conversation_id = c.id
JOIN autopilot_topics t ON t.id = e.gate1_topic_id
JOIN organizations o ON o.id = c.org_id
WHERE c.autopilot_disabled = true
GROUP BY t.id, t.name, o.name
ORDER BY escalated_conversations DESC;

-- ---------------------------------------------------------
-- 7. ACTIVATION READINESS SCORECARD
--    Quick yes/no check per topic. Thresholds you can adjust:
--      - min_volume: at least 20 evaluations
--      - min_pass_rate: 80%+ of evaluations pass all gates
--      - min_approval_rate: 70%+ of passed drafts approved without edits
--      - max_discard_rate: <10% of passed drafts discarded
-- ---------------------------------------------------------
WITH topic_stats AS (
  SELECT
    t.id,
    t.name AS topic,
    t.mode,
    o.name AS org,
    COUNT(e.id) AS total_evals,
    COUNT(e.id) FILTER (WHERE e.all_gates_passed) AS passed,
    COUNT(e.id) FILTER (WHERE e.human_action = 'approved' AND (e.edit_distance IS NULL OR e.edit_distance = 0)) AS approved_no_edits,
    COUNT(e.id) FILTER (WHERE e.human_action = 'discarded' AND e.all_gates_passed) AS discarded_after_pass,
    COUNT(e.id) FILTER (WHERE e.human_action IS NOT NULL AND e.all_gates_passed) AS reviewed
  FROM autopilot_topics t
  JOIN organizations o ON o.id = t.org_id
  LEFT JOIN autopilot_evaluations e ON e.gate1_topic_id = t.id
  WHERE t.mode = 'shadow'
  GROUP BY t.id, t.name, t.mode, o.name
)
SELECT
  topic,
  org,
  total_evals,
  ROUND(100.0 * passed / NULLIF(total_evals, 0), 1) AS pass_rate_pct,
  ROUND(100.0 * approved_no_edits / NULLIF(reviewed, 0), 1) AS no_edit_approval_pct,
  ROUND(100.0 * discarded_after_pass / NULLIF(reviewed, 0), 1) AS discard_rate_pct,
  CASE
    WHEN total_evals < 20 THEN 'NOT READY — insufficient volume (' || total_evals || '/20)'
    WHEN 100.0 * passed / NULLIF(total_evals, 0) < 80 THEN 'NOT READY — pass rate too low'
    WHEN 100.0 * approved_no_edits / NULLIF(reviewed, 0) < 70 THEN 'NOT READY — too many edits needed'
    WHEN 100.0 * discarded_after_pass / NULLIF(reviewed, 0) > 10 THEN 'NOT READY — discard rate too high'
    ELSE 'READY TO ACTIVATE'
  END AS verdict
FROM topic_stats
ORDER BY org, topic;
