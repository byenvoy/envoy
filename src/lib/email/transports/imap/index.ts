import { ImapFlow } from "imapflow";
import { simpleParser, type ParsedMail } from "mailparser";
import { createTransport } from "nodemailer";
import { getValidTokens } from "../../oauth-tokens";
import { OAUTH_PROVIDERS } from "../../oauth-config";
import { getInitialLookbackMinutes, lookbackSinceDate } from "../lookback";
import type {
  CollectedMessage,
  EmailConnectionRow,
  EmailTransport,
  PollResult,
  SendArgs,
  SendResult,
} from "../types";

interface FolderResult {
  messages: CollectedMessage[];
  maxUid: string | null;
}

async function collectFromFolder(
  client: ImapFlow,
  folder: string,
  lastUid: string | null,
  ownEmail: string,
  isSent: boolean
): Promise<FolderResult> {
  const collected: CollectedMessage[] = [];
  let maxUid = lastUid;

  const lock = await client.getMailboxLock(folder);

  try {
    const searchCriteria: Record<string, unknown> = {};
    if (lastUid) {
      searchCriteria.uid = `${Number(lastUid) + 1}:*`;
    } else {
      searchCriteria.since = lookbackSinceDate(getInitialLookbackMinutes());
    }

    const fetched = client.fetch(searchCriteria, {
      uid: true,
      source: true,
    });

    for await (const msg of fetched) {
      const uid = String(msg.uid);
      if (lastUid && uid === lastUid) continue;
      if (!msg.source) continue;

      const parsed: ParsedMail = await simpleParser(msg.source);

      if (!isSent) {
        const fromAddr = parsed.from?.value?.[0]?.address?.toLowerCase();
        if (fromAddr === ownEmail) continue;
      }

      collected.push({
        folder: isSent ? "sent" : "inbox",
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

export const imapSmtpTransport: EmailTransport = {
  async poll(connection: EmailConnectionRow): Promise<PollResult> {
    const tokens = await getValidTokens(connection);
    const ownEmail = connection.emailAddress.toLowerCase();

    if (!connection.imapHost || !connection.imapPort) {
      throw new Error(`IMAP host/port not configured for connection ${connection.id}`);
    }

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

      const inbox = await collectFromFolder(
        client,
        "INBOX",
        connection.lastUid,
        ownEmail,
        false
      );

      let sent: FolderResult = {
        messages: [],
        maxUid: connection.lastSentUid,
      };

      const provider = connection.provider as "google" | "microsoft";
      const sentFolder = OAUTH_PROVIDERS[provider]?.sentFolder;

      if (sentFolder) {
        try {
          sent = await collectFromFolder(
            client,
            sentFolder,
            connection.lastSentUid,
            ownEmail,
            true
          );
        } catch (sentError) {
          console.error(`Failed to poll Sent folder (${sentFolder}):`, sentError);
        }
      }

      return {
        messages: [...inbox.messages, ...sent.messages],
        cursorUpdate: {
          lastUid: inbox.maxUid,
          lastSentUid: sent.maxUid,
        },
      };
    } finally {
      await client.logout().catch(() => {});
    }
  },

  async send(
    connection: EmailConnectionRow,
    args: SendArgs
  ): Promise<SendResult> {
    const tokens = await getValidTokens(connection);

    if (!connection.smtpHost || !connection.smtpPort) {
      throw new Error(`SMTP host/port not configured for connection ${connection.id}`);
    }

    const transport = createTransport({
      host: connection.smtpHost,
      port: connection.smtpPort,
      secure: false,
      auth: {
        type: "OAuth2",
        user: connection.emailAddress,
        accessToken: tokens.access_token,
      },
    });

    const info = await transport.sendMail({
      from: args.from,
      to: args.to,
      subject: args.subject,
      text: args.text,
      html: args.html,
      inReplyTo: args.inReplyTo,
      references: args.references,
    });

    return {
      messageId: info.messageId ?? null,
    };
  },
};
