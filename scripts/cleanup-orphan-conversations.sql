-- One-off cleanup: remove orphan conversations left behind by the
-- messages_source_check bug (see migration 0017). While that constraint
-- rejected source='gmail', every poll created a conversation row and then
-- failed to insert the message, leaving conversations with zero messages.
-- These 500 on regenerate ("No messages in conversation") and clutter the inbox.
--
-- The transactional ingest fix in src/lib/email/process-imap.ts prevents NEW
-- orphans; this removes the ones already in the table.
--
-- Deleting a conversation cascades to its drafts / autopilot_evaluations
-- (onDelete: cascade), but true orphans have neither. Run the SELECT first to
-- review, then the DELETE. The created_at guard avoids racing an in-flight poll.

-- 1) PREVIEW — how many, and which orgs:
SELECT c.org_id, count(*) AS orphan_conversations
FROM conversations c
WHERE NOT EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = c.id)
  AND c.created_at < now() - interval '10 minutes'
GROUP BY c.org_id
ORDER BY orphan_conversations DESC;

-- 2) DELETE — run after reviewing the preview:
-- DELETE FROM conversations c
-- WHERE NOT EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = c.id)
--   AND c.created_at < now() - interval '10 minutes';
