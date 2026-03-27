import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/db/helpers";
import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const auth = await withAuth();
  if (!auth.success) return auth.response;
  const { orgId } = auth.context;

  const org = await db
    .select({
      onboardingStep: organizations.onboardingStep,
      onboardingCompletedAt: organizations.onboardingCompletedAt,
    })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .then((r) => r[0]);

  return NextResponse.json({
    step: org?.onboardingStep ?? 1,
    completedAt: org?.onboardingCompletedAt ?? null,
  });
}

export async function POST(request: NextRequest) {
  const auth = await withAuth();
  if (!auth.success) return auth.response;
  const { orgId } = auth.context;

  const { step } = await request.json();
  if (typeof step !== "number" || step < 1 || step > 4) {
    return NextResponse.json({ error: "Invalid step" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {
    onboardingStep: step,
  };

  if (step === 4) {
    updates.onboardingCompletedAt = new Date();
  }

  // Only advance, never go backward in persisted step
  const org = await db
    .select({ onboardingStep: organizations.onboardingStep })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .then((r) => r[0]);

  if (org && step <= org.onboardingStep) {
    return NextResponse.json({ ok: true });
  }

  try {
    await db
      .update(organizations)
      .set(updates)
      .where(eq(organizations.id, orgId));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
