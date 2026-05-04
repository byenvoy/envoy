import { db } from "@/lib/db";
import { emailConnections } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { GmailClient } from "./transports/gmail/client";
import { getValidTokens } from "./oauth-tokens";

type EmailConnectionRow = typeof emailConnections.$inferSelect;

const ENVOY_LABEL_NAME = "Envoy";

/**
 * Look up or create the org's "Envoy" Gmail label and cache its id on the
 * connection row. Idempotent across runs.
 */
async function getOrCreateEnvoyLabel(
  client: GmailClient,
  connection: EmailConnectionRow
): Promise<string> {
  if (connection.gmailLabelId) return connection.gmailLabelId;

  const existing = await client.listLabels();
  const found = (existing.labels ?? []).find((l) => l.name === ENVOY_LABEL_NAME);

  let labelId: string;
  if (found) {
    labelId = found.id;
  } else {
    const created = await client.createLabel(ENVOY_LABEL_NAME);
    labelId = created.id;
  }

  await db
    .update(emailConnections)
    .set({ gmailLabelId: labelId, updatedAt: new Date() })
    .where(eq(emailConnections.id, connection.id));

  return labelId;
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
