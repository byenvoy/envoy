import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/db/helpers";
import { db } from "@/lib/db";
import { orgApiKeys } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { encrypt } from "@/lib/email/encryption";
import { requireOwner } from "@/lib/permissions";

export async function POST(request: NextRequest) {
  const auth = await withAuth();
  if (!auth.success) return auth.response;
  const { orgId, role } = auth.context;

  const denied = requireOwner(role);
  if (denied) return denied;

  const { provider_key, api_key } = await request.json();

  if (!provider_key || typeof provider_key !== "string") {
    return NextResponse.json({ error: "provider_key is required" }, { status: 400 });
  }

  if (!api_key || typeof api_key !== "string" || api_key.trim().length === 0) {
    return NextResponse.json({ error: "API key is required" }, { status: 400 });
  }

  const encrypted = encrypt(api_key.trim());

  // Upsert: insert or update on conflict
  try {
    await db
      .insert(orgApiKeys)
      .values({
        orgId,
        providerKey: provider_key,
        apiKeyEncrypted: encrypted,
      })
      .onConflictDoUpdate({
        target: [orgApiKeys.orgId, orgApiKeys.providerKey],
        set: {
          apiKeyEncrypted: encrypted,
          updatedAt: new Date(),
        },
      });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const auth = await withAuth();
  if (!auth.success) return auth.response;
  const { orgId, role } = auth.context;

  const denied = requireOwner(role);
  if (denied) return denied;

  const { provider_key } = await request.json();

  if (!provider_key || typeof provider_key !== "string") {
    return NextResponse.json({ error: "provider_key is required" }, { status: 400 });
  }

  try {
    await db
      .delete(orgApiKeys)
      .where(
        and(eq(orgApiKeys.orgId, orgId), eq(orgApiKeys.providerKey, provider_key))
      );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
