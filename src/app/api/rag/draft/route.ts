import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { withAuth, getOrgSubscription, isActiveSubscription } from "@/lib/db/helpers";
import { retrieveAndDraft } from "@/lib/rag/retrieve";
import { isCloud } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  const auth = await withAuth();
  if (!auth.success) return auth.response;
  const { orgId } = auth.context;

  if (isCloud()) {
    const sub = await getOrgSubscription(orgId);
    if (!sub || !isActiveSubscription(sub.status)) {
      return NextResponse.json(
        { error: "Active subscription required" },
        { status: 402 }
      );
    }
  }

  const org = await db
    .select({ name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .then((r) => r[0]);

  const body = await request.json();
  const { message } = body;

  if (!message || typeof message !== "string") {
    return NextResponse.json(
      { error: "Message is required" },
      { status: 400 }
    );
  }

  try {
    const result = await retrieveAndDraft({
      orgId,
      companyName: org?.name ?? "Our Company",
      customerMessage: message,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Draft generation failed:", error);
    return NextResponse.json(
      { error: "Failed to generate draft" },
      { status: 500 }
    );
  }
}
