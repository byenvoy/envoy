import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { subscriptions, profiles } from "@/lib/db/schema";
import { user as userTable } from "@/lib/db/schema/auth";
import { eq } from "drizzle-orm";
import { Resend } from "resend";
import type Stripe from "stripe";

const getResend = () => new Resend(process.env.RESEND_API_KEY);
const fromEmail = process.env.RESEND_FROM_EMAIL ?? "Envoy <onboarding@resend.dev>";

async function getOwnerEmail(stripeCustomerId: string): Promise<string | null> {
  const sub = await db
    .select({ orgId: subscriptions.orgId })
    .from(subscriptions)
    .where(eq(subscriptions.stripeCustomerId, stripeCustomerId))
    .then((r) => r[0] ?? null);
  if (!sub) return null;

  const owner = await db
    .select({ userId: profiles.id })
    .from(profiles)
    .where(eq(profiles.orgId, sub.orgId))
    .then((r) => r.find((p) => p.userId));
  if (!owner) return null;

  const u = await db
    .select({ email: userTable.email })
    .from(userTable)
    .where(eq(userTable.id, owner.userId))
    .then((r) => r[0] ?? null);
  return u?.email ?? null;
}

function priceToPlan(priceId: string): string {
  if (priceId === process.env.STRIPE_PRO_PRICE_ID) return "pro";
  return "pro";
}

async function upsertSubscription(sub: Stripe.Subscription) {
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const priceId = sub.items.data[0]?.price?.id ?? null;

  const itemPeriodEnd = sub.items.data[0]?.current_period_end;

  // Stripe uses cancel_at (timestamp) or cancel_at_period_end (boolean)
  // If either is set, the subscription is scheduled to cancel
  const cancelAt = (sub as unknown as { cancel_at: number | null }).cancel_at;
  const isCanceling = sub.cancel_at_period_end || cancelAt !== null;

  const values = {
    stripeSubscriptionId: sub.id,
    stripeCustomerId: customerId,
    stripePriceId: priceId,
    plan: priceId ? priceToPlan(priceId) : "pro",
    status: sub.status,
    currentPeriodEnd: itemPeriodEnd ? new Date(itemPeriodEnd * 1000) : null,
    cancelAtPeriodEnd: isCanceling,
    trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
    updatedAt: new Date(),
  };

  const existing = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeCustomerId, customerId))
    .then((r) => r[0] ?? null);

  if (existing) {
    await db
      .update(subscriptions)
      .set(values)
      .where(eq(subscriptions.id, existing.id));
  }
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.subscription) {
        const sub = await getStripe().subscriptions.retrieve(
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription.id
        );
        await upsertSubscription(sub);
      }
      break;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      await upsertSubscription(sub);
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId =
        typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      await db
        .update(subscriptions)
        .set({ status: "canceled", cancelAtPeriodEnd: false, updatedAt: new Date() })
        .where(eq(subscriptions.stripeCustomerId, customerId));
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const subDetails = invoice.parent?.subscription_details;
      if (subDetails?.subscription) {
        const subId =
          typeof subDetails.subscription === "string"
            ? subDetails.subscription
            : subDetails.subscription.id;
        await db
          .update(subscriptions)
          .set({ status: "past_due", updatedAt: new Date() })
          .where(eq(subscriptions.stripeSubscriptionId, subId));
      }
      break;
    }

    case "customer.subscription.trial_will_end": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId =
        typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      const ownerEmail = await getOwnerEmail(customerId);
      if (ownerEmail && sub.trial_end) {
        const endDate = new Date(sub.trial_end * 1000).toLocaleDateString(
          "en-US",
          { month: "long", day: "numeric", year: "numeric" }
        );
        void getResend().emails.send({
          from: fromEmail,
          to: ownerEmail,
          subject: "Your Envoy trial ends in 3 days",
          html: `<p>Your 14-day free trial ends on ${endDate}.</p><p>After that, your Pro subscription ($15/mo) will begin automatically and your card will be charged.</p><p>You can manage or cancel your subscription anytime from <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/settings">Settings</a>.</p>`,
        });
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
