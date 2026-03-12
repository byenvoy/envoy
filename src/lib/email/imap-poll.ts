import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { createAdminClient } from "@/lib/supabase/admin";
import { getValidTokens } from "./oauth-tokens";
import { processImapEmail } from "./process-imap";
import type { EmailConnection } from "@/lib/types/database";

export async function pollConnection(
  connection: EmailConnection
): Promise<number> {
  const tokens = await getValidTokens(connection);
  const admin = createAdminClient();
  let ticketsCreated = 0;

  const client = new ImapFlow({
    host: connection.imap_host,
    port: connection.imap_port,
    secure: true,
    auth: {
      user: connection.email_address,
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
      if (connection.last_uid) {
        searchCriteria.uid = `${Number(connection.last_uid) + 1}:*`;
      } else {
        // First poll: only get messages from last 24 hours
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        searchCriteria.since = since;
      }

      const messages = client.fetch(searchCriteria, {
        uid: true,
        source: true,
      });

      let maxUid = connection.last_uid;

      for await (const msg of messages) {
        const uid = String(msg.uid);

        // Skip if this is the same as last_uid (range is inclusive)
        if (connection.last_uid && uid === connection.last_uid) continue;

        if (!msg.source) continue;
        const parsed = await simpleParser(msg.source);

        const fromAddr = parsed.from?.value?.[0]?.address?.toLowerCase();

        // Skip own outgoing mail
        if (fromAddr === connection.email_address.toLowerCase()) continue;

        // TEST FILTER: only process emails from allowed senders
        const testAllowList = process.env.IMAP_ALLOW_SENDERS?.split(",").map(s => s.trim().toLowerCase());
        if (testAllowList && testAllowList.length > 0 && (!fromAddr || !testAllowList.includes(fromAddr))) continue;

        const ticket = await processImapEmail(parsed, connection);
        if (ticket) ticketsCreated++;

        if (!maxUid || Number(uid) > Number(maxUid)) {
          maxUid = uid;
        }
      }

      // Update connection state
      await admin
        .from("email_connections")
        .update({
          last_uid: maxUid,
          last_polled_at: new Date().toISOString(),
          status: "active",
          error_message: null,
        })
        .eq("id", connection.id);
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }

  return ticketsCreated;
}
