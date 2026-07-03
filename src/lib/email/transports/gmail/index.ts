import { simpleParser } from "mailparser";
import MailComposer from "nodemailer/lib/mail-composer";
import { getValidTokens } from "../../oauth-tokens";
import {
  GmailClient,
  GmailHistoryExpiredError,
  type GmailMessage,
} from "./client";
import {
  getInitialLookbackMinutes,
  getFallbackLookbackMinutes,
  lookbackUnixSeconds,
} from "../lookback";
import type {
  CollectedMessage,
  EmailConnectionRow,
  EmailTransport,
  PollResult,
  SendArgs,
  SendResult,
} from "../types";

const MAX_MESSAGES_PER_POLL = 500;

async function collectFromMessageIds(
  client: GmailClient,
  ids: string[],
  ownEmail: string
): Promise<CollectedMessage[]> {
  const collected: CollectedMessage[] = [];

  for (const id of ids) {
    let msg: GmailMessage;
    try {
      msg = await client.getMessage(id, "raw");
    } catch (err) {
      // 404 — message deleted between list and get; skip
      console.error(`Failed to fetch Gmail message ${id}:`, err);
      continue;
    }

    if (!msg.raw) continue;

    const labels = msg.labelIds ?? [];
    const isInbox = labels.includes("INBOX");
    const isSent = labels.includes("SENT");
    if (!isInbox && !isSent) continue;

    const parsed = await simpleParser(Buffer.from(msg.raw, "base64url"));

    // Inbox: skip own outgoing echoes (drafts, sent-to-self)
    if (isInbox) {
      const fromAddr = parsed.from?.value?.[0]?.address?.toLowerCase();
      if (fromAddr === ownEmail) continue;
    }

    collected.push({
      folder: isSent ? "sent" : "inbox",
      parsed,
      date: parsed.date ?? new Date(0),
      source: "gmail",
      providerThreadId: msg.threadId,
    });
  }

  return collected;
}

async function fullSync(
  client: GmailClient,
  ownEmail: string,
  lookbackMinutes: number
): Promise<{ messages: CollectedMessage[]; historyId: string | null }> {
  // Gmail's `newer_than:` only supports d/m/y. Use `after:UNIX_TIMESTAMP`
  // for arbitrary minute-level precision (lets dev scope to ~30 min).
  const afterTs = lookbackUnixSeconds(lookbackMinutes);
  const list = await client.listMessages(
    `after:${afterTs}`,
    MAX_MESSAGES_PER_POLL
  );
  const ids = (list.messages ?? []).map((m) => m.id);
  const messages = await collectFromMessageIds(client, ids, ownEmail);
  const profile = await client.getProfile();
  return { messages, historyId: profile.historyId };
}

async function incrementalSync(
  client: GmailClient,
  ownEmail: string,
  startHistoryId: string
): Promise<{ messages: CollectedMessage[]; historyId: string | null }> {
  const addedIds = new Set<string>();
  let pageToken: string | undefined;
  let latestHistoryId: string | null = startHistoryId;

  do {
    const page = await client.listHistory(
      startHistoryId,
      ["messageAdded"],
      pageToken
    );
    for (const record of page.history ?? []) {
      for (const added of record.messagesAdded ?? []) {
        addedIds.add(added.message.id);
      }
    }
    if (page.historyId) latestHistoryId = page.historyId;
    pageToken = page.nextPageToken;
  } while (pageToken);

  const messages = await collectFromMessageIds(
    client,
    Array.from(addedIds),
    ownEmail
  );
  return { messages, historyId: latestHistoryId };
}

async function buildRawMessage(args: SendArgs): Promise<{
  raw: Buffer;
  messageId: string | null;
}> {
  const composer = new MailComposer({
    from: args.from,
    to: args.to,
    subject: args.subject,
    text: args.text,
    html: args.html,
    inReplyTo: args.inReplyTo,
    references: args.references,
  });

  const raw = await new Promise<Buffer>((resolve, reject) => {
    composer.compile().build((err, message) => {
      if (err) reject(err);
      else resolve(message);
    });
  });

  // Parse to recover the auto-generated Message-ID header
  const parsed = await simpleParser(raw);
  return { raw, messageId: parsed.messageId ?? null };
}

export const gmailTransport: EmailTransport = {
  async poll(connection: EmailConnectionRow): Promise<PollResult> {
    const tokens = await getValidTokens(connection);
    const client = new GmailClient(tokens.access_token);
    const ownEmail = connection.emailAddress.toLowerCase();

    let result: { messages: CollectedMessage[]; historyId: string | null };

    if (!connection.historyId) {
      result = await fullSync(client, ownEmail, getInitialLookbackMinutes());
    } else {
      try {
        result = await incrementalSync(client, ownEmail, connection.historyId);
      } catch (err) {
        if (err instanceof GmailHistoryExpiredError) {
          // History expired (>~1 week stale) — refetch recent + capture fresh historyId
          result = await fullSync(client, ownEmail, getFallbackLookbackMinutes());
        } else {
          throw err;
        }
      }
    }

    return {
      messages: result.messages,
      cursorUpdate: { historyId: result.historyId },
    };
  },

  async send(
    connection: EmailConnectionRow,
    args: SendArgs
  ): Promise<SendResult> {
    const tokens = await getValidTokens(connection);
    const client = new GmailClient(tokens.access_token);

    const { raw, messageId: composedMessageId } = await buildRawMessage(args);
    const rawBase64Url = raw.toString("base64url");

    const sent = await client.sendMessage(rawBase64Url, args.providerThreadId);

    // Gmail rewrites the Message-ID header on API sends (our composed
    // <...@domain> id becomes <...@mail.gmail.com>). Persisting the composed
    // id breaks sent-copy dedup on the next poll — the ingested copy's id
    // matches nothing, creating a duplicate outbound message. Fetch the
    // final header so we store what the mailbox actually contains.
    let messageId = composedMessageId;
    try {
      const meta = await client.getMessage(sent.id, "metadata", ["Message-ID"]);
      const header = meta.payload?.headers?.find(
        (h) => h.name.toLowerCase() === "message-id"
      )?.value;
      if (header) messageId = header;
    } catch (err) {
      console.error(`Failed to fetch sent message metadata for ${sent.id}:`, err);
    }

    return {
      messageId,
      providerThreadId: sent.threadId,
    };
  },
};
