import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { subscriptions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";

function priceToPlan(priceId: string): string {
  if (priceId === process.env.STRIPE_PRO_PRICE_ID) return "pro";
  return "pro";
}

async function upsertSubscription(sub: Stripe.Subscription) {
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const priceId = sub.items.data[0]?.price?.id ?? null;

  const itemPeriodEnd = sub.items.data[0]?.current_period_end;

  const values = {
    stripeSubscriptionId: sub.id,
    stripeCustomerId: customerId,
    stripePriceId: priceId,
    plan: priceId ? priceToPlan(priceId) : "pro",
    status: sub.status,
    currentPeriodEnd: itemPeriodEnd ? new Date(itemPeriodEnd * 1000) : null,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
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
  }

  return NextResponse.json({ received: true });
}
