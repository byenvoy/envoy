import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/db/helpers";
import { db } from "@/lib/db";
import { conversations, messages, drafts, emailAddresses, emailConnections } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { sendReply } from "@/lib/email/send-reply";
import { archiveAndLabelGmailThread } from "@/lib/email/gmail-sync";
import { marked } from "marked";
import { captureEvent } from "@/lib/posthog-server";

/**
 * Compose and send a manual reply — used when no AI draft was generated
 * (e.g. escalated conversations). Creates a draft row, sends the email,
 * and marks it approved in one step.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await withAuth();
  if (!auth.success) return auth.response;
  const { userId, orgId } = auth.context;

  const body = await request.json().catch(() => ({}));
  const content = body.content;
  const closeAfterSend = body.close === true;

  if (!content || typeof content !== "string" || !content.trim()) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  const conversation = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.orgId, orgId)))
    .then((r) => r[0]);

  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const latestInbound = await db
    .select()
    .from(messages)
    .where(and(eq(messages.conversationId, id), eq(messages.direction, "inbound")))
    .orderBy(desc(messages.createdAt))
    .limit(1)
    .then((r) => r[0]);

  if (!latestInbound) {
    return NextResponse.json({ error: "No inbound message found" }, { status: 404 });
  }

  const emailAddr = await db
    .select({
      emailAddress: emailAddresses.emailAddress,
      displayName: emailAddresses.displayName,
    })
    .from(emailAddresses)
    .where(and(eq(emailAddresses.orgId, orgId), eq(emailAddresses.isActive, true)))
    .limit(1)
    .then((r) => r[0]);

  if (!emailAddr) {
    return NextResponse.json({ error: "No email address configured" }, { status: 400 });
  }

  const connectionId = latestInbound.connectionId;
  if (!connectionId) {
    return NextResponse.json({ error: "No email connection found" }, { status: 400 });
  }

  const replyHtml = await marked.parse(content, { breaks: true });

  try {
    const outboundMessageId = await sendReply({
      conversation,
      latestInboundMessage: latestInbound,
      replyContent: content,
      replyHtml,
      emailAddr,
      connectionId,
    });

    // Create draft row for audit trail
    await db.insert(drafts).values({
      conversationId: id,
      orgId,
      draftContent: content,
      status: "approved",
      messageId: outboundMessageId,
      approvedAt: new Date(),
      approvedBy: userId,
    });

    captureEvent(userId, orgId, "manual_reply_sent");

    // If close requested, mirror the closed state to Gmail (archive +
    // Envoy/Handled label). Re-read gmailThreadId via returning() —
    // sendReply may have populated it for the first time on this send.
    if (closeAfterSend) {
      const closedConversation = await db
        .update(conversations)
        .set({ status: "closed" })
        .where(eq(conversations.id, id))
        .returning({ gmailThreadId: conversations.gmailThreadId })
        .then((r) => r[0]);

      if (closedConversation?.gmailThreadId) {
        const conn = await db
          .select()
          .from(emailConnections)
          .where(and(eq(emailConnections.orgId, orgId), eq(emailConnections.provider, "google")))
          .then((r) => r[0] ?? null);
        if (conn) {
          void archiveAndLabelGmailThread(closedConversation.gmailThreadId, conn);
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to send manual reply:", error);
    return NextResponse.json({ error: "Failed to send reply" }, { status: 500 });
  }
}
