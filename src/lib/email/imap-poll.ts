import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { db } from "@/lib/db";
import { emailConnections } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getValidTokens } from "./oauth-tokens";
import { processImapEmail } from "./process-imap";
type EmailConnectionRow = typeof emailConnections.$inferSelect;

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
    const lock = await client.getMailboxLock("INBOX");

    try {
      // Search for messages newer than last_uid
      const searchCriteria: Record<string, unknown> = {};
      if (connection.lastUid) {
        searchCriteria.uid = `${Number(connection.lastUid) + 1}:*`;
      } else {
        // First poll: only get messages from last 24 hours
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        searchCriteria.since = since;
      }

      const messages = client.fetch(searchCriteria, {
        uid: true,
        source: true,
      });

      let maxUid = connection.lastUid;

      for await (const msg of messages) {
        const uid = String(msg.uid);

        // Skip if this is the same as last_uid (range is inclusive)
        if (connection.lastUid && uid === connection.lastUid) continue;

        if (!msg.source) continue;
        const parsed = await simpleParser(msg.source);

        const fromAddr = parsed.from?.value?.[0]?.address?.toLowerCase();

        // Skip own outgoing mail
        if (fromAddr === connection.emailAddress.toLowerCase()) continue;

        // TEST FILTER: only process emails from allowed senders
        const testAllowList = process.env.IMAP_ALLOW_SENDERS?.split(",").map(s => s.trim().toLowerCase());
        if (testAllowList && testAllowList.length > 0 && (!fromAddr || !testAllowList.includes(fromAddr))) continue;

        const conversation = await processImapEmail(parsed, connection);
        if (conversation) processed++;

        if (!maxUid || Number(uid) > Number(maxUid)) {
          maxUid = uid;
        }
      }

      // Update connection state
      await db
        .update(emailConnections)
        .set({
          lastUid: maxUid,
          lastPolledAt: new Date(),
          status: "active",
          errorMessage: null,
        })
        .where(eq(emailConnections.id, connection.id));
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }

  return processed;
}
