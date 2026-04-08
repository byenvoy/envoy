import { ImapFlow } from "imapflow";
import { simpleParser, type ParsedMail } from "mailparser";
import { db } from "@/lib/db";
import { emailConnections, conversations, messages, drafts } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getValidTokens } from "./oauth-tokens";
import { processImapEmail } from "./process-imap";
import { processSentEmail } from "./process-sent";
import { generateDraftForConversation } from "./generate-draft";
import { checkAndEscalateThread } from "@/lib/autopilot/escalation";
import { OAUTH_PROVIDERS } from "./oauth-config";
type EmailConnectionRow = typeof emailConnections.$inferSelect;

interface CollectedMessage {
  folder: "inbox" | "sent";
  uid: string;
  parsed: ParsedMail;
  date: Date;
}

/**
 * Collect all new messages from a folder without processing them.
 */
async function collectFromFolder(
  client: ImapFlow,
  folder: string,
  lastUid: string | null,
  ownEmail: string,
  isSent: boolean
): Promise<{ messages: CollectedMessage[]; maxUid: string | null }> {
  const collected: CollectedMessage[] = [];
  let maxUid = lastUid;

  const lock = await client.getMailboxLock(folder);

  try {
    const searchCriteria: Record<string, unknown> = {};
    if (lastUid) {
      searchCriteria.uid = `${Number(lastUid) + 1}:*`;
    } else {
      const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      searchCriteria.since = since;
    }

    const fetched = client.fetch(searchCriteria, {
      uid: true,
      source: true,
    });

    for await (const msg of fetched) {
      const uid = String(msg.uid);
      if (lastUid && uid === lastUid) continue;
      if (!msg.source) continue;

      const parsed = await simpleParser(msg.source);

      // For inbox: skip own outgoing mail
      if (!isSent) {
        const fromAddr = parsed.from?.value?.[0]?.address?.toLowerCase();
        if (fromAddr === ownEmail) continue;
      }

      collected.push({
        folder: isSent ? "sent" : "inbox",
        uid,
        parsed,
        date: parsed.date ?? new Date(0),
      });

      if (!maxUid || Number(uid) > Number(maxUid)) {
        maxUid = uid;
      }
    }
  } finally {
    lock.release();
  }

  return { messages: collected, maxUid };
}

export async function pollConnection(
  connection: EmailConnectionRow
): Promise<number> {
  const tokens = await getValidTokens(connection);
  let processed = 0;

  const client = new ImapFlow({
    host: connection.imapHost,
    port: connection.imapPort,
    secure: true,
    auth: {
      user: connection.emailAddress,
      accessToken: tokens.access_token,
    },
    logger: false,
  });

  try {
    await client.connect();
    const ownEmail = connection.emailAddress.toLowerCase();

    // Collect messages from both folders
    const inbox = await collectFromFolder(
      client, "INBOX", connection.lastUid, ownEmail, false
    );

    let sent: { messages: CollectedMessage[]; maxUid: string | null } = { messages: [], maxUid: connection.lastSentUid };
    const provider = connection.provider as "google" | "microsoft";
    const sentFolder = OAUTH_PROVIDERS[provider]?.sentFolder;

    if (sentFolder) {
      try {
        sent = await collectFromFolder(
          client, sentFolder, connection.lastSentUid, ownEmail, true
        );
      } catch (sentError) {
        console.error(`Failed to poll Sent folder (${sentFolder}):`, sentError);
      }
    }

    // --- Phase 1: Ingest all messages in chronological order ---
    const allMessages = [...inbox.messages, ...sent.messages].sort(
      (a, b) => a.date.getTime() - b.date.getTime()
    );

    const touchedConversationIds = new Set<string>();

    for (const msg of allMessages) {
      let conversationId: string | null = null;
      if (msg.folder === "inbox") {
        conversationId = await processImapEmail(msg.parsed, connection);
      } else {
        conversationId = await processSentEmail(msg.parsed, connection);
      }
      if (conversationId) {
        touchedConversationIds.add(conversationId);
        processed++;
      }
    }

    // --- Phase 2: Escalation checks + draft generation ---
    // Now that all messages are ingested, evaluate each touched conversation
    for (const conversationId of touchedConversationIds) {
      // Check the final state of the conversation
      const lastMsg = await db
        .select({ direction: messages.direction, bodyText: messages.bodyText })
        .from(messages)
        .where(eq(messages.conversationId, conversationId))
        .orderBy(desc(messages.createdAt))
        .limit(1)
        .then((r) => r[0]);

      // If the last message is outbound, the agent already replied — set to waiting
      if (lastMsg?.direction !== "inbound") {
        await db
          .update(conversations)
          .set({ status: "waiting", updatedAt: new Date() })
          .where(eq(conversations.id, conversationId));
        continue;
      }

      // Skip if a pending draft already exists
      const existingDraft = await db
        .select({ id: drafts.id })
        .from(drafts)
        .where(
          and(
            eq(drafts.conversationId, conversationId),
            eq(drafts.status, "pending")
          )
        )
        .limit(1)
        .then((r) => r[0]);

      if (existingDraft) continue;

      // Escalation check: was the last approved draft auto-sent?
      if (lastMsg.bodyText) {
        try {
          const lastApprovedDraft = await db
            .select({ sentByAutopilot: drafts.sentByAutopilot })
            .from(drafts)
            .where(
              and(
                eq(drafts.conversationId, conversationId),
                eq(drafts.status, "approved")
              )
            )
            .orderBy(desc(drafts.createdAt))
            .limit(1)
            .then((r) => r[0]);

          if (lastApprovedDraft?.sentByAutopilot) {
            await checkAndEscalateThread({
              conversationId,
              customerMessage: lastMsg.bodyText,
              orgId: connection.orgId,
            });
          }
        } catch {
          // Escalation check failure should not block draft generation
        }
      }

      await generateDraftForConversation(conversationId);
    }

    // --- Phase 3: Update connection state ---
    await db
      .update(emailConnections)
      .set({
        lastUid: inbox.maxUid,
        lastSentUid: sent.maxUid,
        lastPolledAt: new Date(),
        status: "active",
        errorMessage: null,
      })
      .where(eq(emailConnections.id, connection.id));
  } finally {
    await client.logout().catch(() => {});
  }

  return processed;
}
