import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { emailConnections, emailAddresses } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/db/helpers";

export async function POST(request: NextRequest) {
  const auth = await withAuth();
  if (!auth.success) return auth.response;
  const { orgId } = auth.context;

  const { provider } = await request.json();
  if (provider !== "google" && provider !== "microsoft") {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }

  // Get the connection to find the email address
  const connection = await db
    .select({ emailAddress: emailConnections.emailAddress })
    .from(emailConnections)
    .where(
      and(
        eq(emailConnections.orgId, orgId),
        eq(emailConnections.provider, provider)
      )
    )
    .then((r) => r[0]);

  // Delete the connection
  await db
    .delete(emailConnections)
    .where(
      and(
        eq(emailConnections.orgId, orgId),
        eq(emailConnections.provider, provider)
      )
    );

  // Deactivate the associated email address
  if (connection) {
    await db
      .update(emailAddresses)
      .set({ isActive: false })
      .where(
        and(
          eq(emailAddresses.orgId, orgId),
          eq(emailAddresses.emailAddress, connection.emailAddress),
          eq(emailAddresses.connectionType, "oauth")
        )
      );
  }

  return NextResponse.json({ ok: true });
}
