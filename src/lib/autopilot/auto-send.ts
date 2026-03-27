import { db } from "@/lib/db";
import {
  conversations,
  messages,
  drafts,
  emailAddresses,
} from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { incrementAutopilotDailySends } from "@/lib/db/helpers";
import { sendReply } from "@/lib/email/send-reply";


/**
 * Auto-send a draft reply, mirroring the manual approve flow.
 * Reuses the existing sendReply() infrastructure.
 */
export async function autoSendDraft({
  conversationId,
  draftId,
  draftContent,
  orgId,
  topicId,
}: {
  conversationId: string;
  draftId: string;
  draftContent: string;
  orgId: string;
  topicId: string;
}): Promise<void> {
  // Fetch conversation
  const conversation = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .then((r) => r[0]);

  if (!conversation) throw new Error("Conversation not found for auto-send");

  // Fetch latest inbound message for reply threading
  const latestInbound = await db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conversationId),
        eq(messages.direction, "inbound")
      )
    )
    .orderBy(desc(messages.createdAt))
    .limit(1)
    .then((r) => r[0]);

  if (!latestInbound) throw new Error("No inbound message found for auto-send");

  // Get org's email address
  const emailAddr = await db
    .select({
      emailAddress: emailAddresses.emailAddress,
      displayName: emailAddresses.displayName,
    })
    .from(emailAddresses)
    .where(
      and(
        eq(emailAddresses.orgId, orgId),
        eq(emailAddresses.isActive, true)
      )
    )
    .limit(1)
    .then((r) => r[0]);

  if (!emailAddr) throw new Error("No email address configured for auto-send");

  const connectionId = latestInbound.connectionId;
  if (!connectionId) throw new Error("No email connection found for auto-send");

  const replyHtml = draftContent.replace(/\n/g, "<br>");

  // Send via SMTP (same function as manual approve)
  const outboundMessageId = await sendReply({
    conversation,
    latestInboundMessage: latestInbound,
    replyContent: draftContent,
    replyHtml,
    emailAddr,
    connectionId,
    sentByAutopilot: true,
  });

  // Update draft status
  await db
    .update(drafts)
    .set({
      status: "approved",
      messageId: outboundMessageId,
      approvedAt: new Date(),
      approvedBy: null,
      sentByAutopilot: true,
    })
    .where(eq(drafts.id, draftId));

  // Atomic increment of daily send count with limit check
  await incrementAutopilotDailySends(topicId);
}
