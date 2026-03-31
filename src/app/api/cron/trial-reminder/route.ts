import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { subscriptions, profiles } from "@/lib/db/schema";
import { user as userTable } from "@/lib/db/schema/auth";
import { eq, and, lte, gte } from "drizzle-orm";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const fromEmail =
  process.env.RESEND_FROM_EMAIL ?? "Envoyer <onboarding@resend.dev>";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // Find trialing subscriptions that end within the next 24 hours
  const trialingSubs = await db
    .select({
      orgId: subscriptions.orgId,
      trialEndsAt: subscriptions.trialEndsAt,
    })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.status, "trialing"),
        lte(subscriptions.trialEndsAt, tomorrow),
        gte(subscriptions.trialEndsAt, now)
      )
    );

  let sent = 0;

  for (const sub of trialingSubs) {
    if (!sub.trialEndsAt) continue;

    // Find the owner's email for this org
    const owner = await db
      .select({ userId: profiles.id })
      .from(profiles)
      .where(and(eq(profiles.orgId, sub.orgId), eq(profiles.role, "owner")))
      .then((r) => r[0] ?? null);

    if (!owner) continue;

    const u = await db
      .select({ email: userTable.email })
      .from(userTable)
      .where(eq(userTable.id, owner.userId))
      .then((r) => r[0] ?? null);

    if (!u?.email) continue;

    const endDate = sub.trialEndsAt.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    void resend.emails.send({
      from: fromEmail,
      to: u.email,
      subject: "Your Envoyer trial ends tomorrow",
      html: `<p>Your free trial ends tomorrow (${endDate}).</p><p>Your Pro subscription ($15/mo) will start and your card will be charged.</p><p>You can manage or cancel your subscription anytime from <a href="${appUrl}/settings">Settings</a>.</p>`,
    });

    sent++;
  }

  return NextResponse.json({ sent });
}
