import { or, ne, isNull, lt } from "drizzle-orm";
import { conversations } from "@/lib/db/schema";

/**
 * Safety valve: if a pipeline run dies before recording a decision, the
 * conversation would sit in 'generating' forever. After this long it is
 * shown regardless, with the compose panel as a usable fallback.
 */
const GENERATING_GRACE_MS = 10 * 60 * 1000;

/**
 * Inbox visibility: conversations appear once the draft pipeline has
 * decided what to do with the latest inbound message. Hides only open
 * conversations still in 'generating' (and only briefly — see grace
 * period). Waiting/closed conversations, decided states (drafted /
 * escalated / skipped / failed), and legacy rows (null) always show.
 *
 * Shared by the /api/conversations route and the inbox page's SSR query
 * so the list and its tab counts can't drift apart.
 */
export function conversationDecidedFilter() {
  const generatingCutoff = new Date(Date.now() - GENERATING_GRACE_MS);
  return or(
    ne(conversations.status, "open"),
    isNull(conversations.draftState),
    ne(conversations.draftState, "generating"),
    lt(conversations.lastMessageAt, generatingCutoff)
  )!;
}
