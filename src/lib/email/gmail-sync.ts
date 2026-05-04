import { db } from "@/lib/db";
import { emailConnections } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { GmailClient } from "./transports/gmail/client";
import { getValidTokens } from "./oauth-tokens";

type EmailConnectionRow = typeof emailConnections.$inferSelect;

// Hierarchical so future child labels (Replied, Discarded, Escalated…) nest
// cleanly under the same parent without a data migration. Gmail's UI only
// renders the slash as a hierarchy when BOTH parent and child labels exist
// — creating just "Envoy/Handled" without "Envoy" leaves it visually flat.
const ENVOY_PARENT_LABEL = "Envoy";
const ENVOY_HANDLED_LABEL = "Envoy/Handled";

async function findOrCreateLabel(client: GmailClient, name: string): Promise<string> {
  const existing = await client.listLabels();
  const found = (existing.labels ?? []).find((l) => l.name === name);
  if (found) return found.id;
  const created = await client.createLabel(name);
  return created.id;
}

/**
 * Look up or create both the parent "Envoy" label and the "Envoy/Handled"
 * child. Returns the child id (the one we actually apply to threads).
 * Caches the child id on the connection row to skip the lookup next time.
 */
async function getOrCreateEnvoyLabel(
  client: GmailClient,
  connection: EmailConnectionRow
): Promise<string> {
  if (connection.gmailLabelId) return connection.gmailLabelId;

  // Ensure the parent exists first so Gmail's UI nests the child.
  await findOrCreateLabel(client, ENVOY_PARENT_LABEL);
  const childId = await findOrCreateLabel(client, ENVOY_HANDLED_LABEL);

  await db
    .update(emailConnections)
    .set({ gmailLabelId: childId, updatedAt: new Date() })
    .where(eq(emailConnections.id, connection.id));

  return childId;
}

/**
 * Mark a Gmail thread as read by removing the UNREAD label from every
 * message in it. No-op if the connection isn't a Gmail connection or
 * we don't have a Gmail thread id for the conversation.
 *
 * Idempotent and safe to call repeatedly. Failures are swallowed — sync
 * is best-effort and shouldn't block the user-facing flow.
 */
export async function markGmailThreadRead(
  threadId: string | null,
  connection: EmailConnectionRow
): Promise<void> {
  if (!threadId || connection.provider !== "google") return;
  try {
    const tokens = await getValidTokens(connection);
    const client = new GmailClient(tokens.access_token);
    await client.modifyThread(threadId, { removeLabelIds: ["UNREAD"] });
  } catch (err) {
    console.error(`Gmail markThreadRead failed for ${threadId}:`, err);
  }
}

/**
 * Archive a Gmail thread (remove INBOX label), mark it read (remove UNREAD),
 * and apply the org's "Envoy" label. Used when a conversation is closed in
 * Envoy so the user's Gmail mirrors the resolved state.
 */
export async function archiveAndLabelGmailThread(
  threadId: string | null,
  connection: EmailConnectionRow
): Promise<void> {
  if (!threadId || connection.provider !== "google") return;
  try {
    const tokens = await getValidTokens(connection);
    const client = new GmailClient(tokens.access_token);
    const labelId = await getOrCreateEnvoyLabel(client, connection);
    await client.modifyThread(threadId, {
      addLabelIds: [labelId],
      removeLabelIds: ["INBOX", "UNREAD"],
    });
  } catch (err) {
    console.error(`Gmail archiveAndLabel failed for ${threadId}:`, err);
  }
}
