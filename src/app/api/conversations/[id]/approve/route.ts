import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/db/helpers";
import { db } from "@/lib/db";
import { conversations, messages, drafts, emailAddresses, autopilotEvaluations } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { sendReply } from "@/lib/email/send-reply";
import { marked } from "marked";


/** Simple word-level edit distance (Levenshtein on word arrays). */
function computeWordEditDistance(a: string, b: string): number {
  const wordsA = a.trim().split(/\s+/);
  const wordsB = b.trim().split(/\s+/);
  const m = wordsA.length;
  const n = wordsB.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = wordsA[i - 1] === wordsB[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await withAuth();
  if (!auth.success) return auth.response;
  const { userId, orgId } = auth.context;

  // Fetch conversation
  const conversation = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.orgId, orgId)))
    .then((r) => r[0]);

  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  // Fetch latest pending draft
  const draft = await db
    .select()
    .from(drafts)
    .where(and(eq(drafts.conversationId, id), eq(drafts.status, "pending")))
    .orderBy(desc(drafts.createdAt))
    .limit(1)
    .then((r) => r[0]);

  if (!draft) {
    return NextResponse.json({ error: "No pending draft found" }, { status: 404 });
  }

  // Get latest inbound message for reply threading
  const latestInbound = await db
    .select()
    .from(messages)
    .where(
      and(eq(messages.conversationId, id), eq(messages.direction, "inbound"))
    )
    .orderBy(desc(messages.createdAt))
    .limit(1)
    .then((r) => r[0]);

  if (!latestInbound) {
    return NextResponse.json({ error: "No inbound message found" }, { status: 404 });
  }

  // Check for edited content and close flag in request body
  const body = await request.json().catch(() => ({}));
  const editedContent = body.edited_content;
  const closeAfterSend = body.close === true;

  // Get org's email address and connection for sending
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
    return NextResponse.json(
      { error: "No email address configured" },
      { status: 400 }
    );
  }

  // Find the connection ID from the latest inbound message
  const connectionId = latestInbound.connectionId;
  if (!connectionId) {
    return NextResponse.json(
      { error: "No email connection found for this conversation" },
      { status: 400 }
    );
  }

  const replyContent = editedContent ?? draft.editedContent ?? draft.draftContent;
  const replyHtml = await marked.parse(replyContent, { breaks: true });

  try {
    const outboundMessageId = await sendReply({
      conversation,
      latestInboundMessage: latestInbound,
      replyContent,
      replyHtml,
      emailAddr,
      connectionId,
    });

    // Update draft
    await db
      .update(drafts)
      .set({
        status: "approved",
        messageId: outboundMessageId,
        approvedAt: new Date(),
        approvedBy: userId,
        ...(editedContent ? { editedContent } : {}),
      })
      .where(eq(drafts.id, draft.id));

    // Record shadow mode human action if this draft was evaluated by autopilot
    if (draft.autopilotEvaluationId) {
      const wasEdited = !!(editedContent && editedContent !== draft.draftContent);
      const editDistance = wasEdited
        ? computeWordEditDistance(draft.draftContent, editedContent!)
        : 0;

      await db
        .update(autopilotEvaluations)
        .set({
          humanAction: wasEdited ? "approved_with_edit" : "approved_no_edit",
          editDistance,
        })
        .where(eq(autopilotEvaluations.id, draft.autopilotEvaluationId));
    }

    // If close requested, override the "waiting" status set by sendReply
    if (closeAfterSend) {
      await db
        .update(conversations)
        .set({ status: "closed" })
        .where(eq(conversations.id, id));
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to send reply:", error);
    return NextResponse.json(
      { error: "Failed to send reply" },
      { status: 500 }
    );
  }
}
