import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/db/helpers";
import { db } from "@/lib/db";
import { conversations, drafts, emailConnections } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { archiveAndLabelGmailThread } from "@/lib/email/gmail-sync";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await withAuth();
  if (!auth.success) return auth.response;
  const { orgId } = auth.context;

  // Discard any pending drafts
  await db
    .update(drafts)
    .set({ status: "discarded" })
    .where(
      and(
        eq(drafts.conversationId, id),
        eq(drafts.orgId, orgId),
        eq(drafts.status, "pending")
      )
    );

  // Close the conversation
  let conversation;
  try {
    conversation = await db
      .update(conversations)
      .set({ status: "closed" })
      .where(and(eq(conversations.id, id), eq(conversations.orgId, orgId)))
      .returning({ gmailThreadId: conversations.gmailThreadId })
      .then((r) => r[0]);
  } catch {
    return NextResponse.json({ error: "Failed to close" }, { status: 500 });
  }

  // Fire-and-forget: archive + label in Gmail so the user's mailbox mirrors
  // the closed state. Skipped silently if not a Gmail connection.
  if (conversation?.gmailThreadId) {
    void (async () => {
      const conn = await db
        .select()
        .from(emailConnections)
        .where(and(eq(emailConnections.orgId, orgId), eq(emailConnections.provider, "google")))
        .then((r) => r[0] ?? null);
      if (conn) await archiveAndLabelGmailThread(conversation.gmailThreadId, conn);
    })();
  }

  return NextResponse.json({ ok: true });
}
