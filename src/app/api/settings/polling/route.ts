import { NextResponse } from "next/server";
import { withAuth } from "@/lib/db/helpers";
import { db } from "@/lib/db";
import { organizations, emailConnections } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { requireOwner } from "@/lib/permissions";
import { pollConnection } from "@/lib/email/imap-poll";

export async function POST() {
  const auth = await withAuth();
  if (!auth.success) return auth.response;
  const { orgId, role } = auth.context;

  const denied = requireOwner(role);
  if (denied) return denied;

  await db
    .update(organizations)
    .set({ pollingEnabled: true, updatedAt: new Date() })
    .where(eq(organizations.id, orgId));

  // Fire-and-forget the first poll so the user doesn't wait until the next
  // cron tick (~2 min) to see content. Errors here are non-fatal — the cron
  // will retry on its normal cadence.
  const connections = await db
    .select()
    .from(emailConnections)
    .where(
      and(
        eq(emailConnections.orgId, orgId),
        inArray(emailConnections.status, ["active", "error"])
      )
    );

  for (const conn of connections) {
    void pollConnection(conn).catch((err) => {
      console.error(`Initial poll failed for connection ${conn.id}:`, err);
    });
  }

  return NextResponse.json({ ok: true });
}
