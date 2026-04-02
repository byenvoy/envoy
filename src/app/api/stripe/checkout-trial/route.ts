import { NextRequest, NextResponse } from "next/server";
import { withAuth, getOrgSubscription } from "@/lib/db/helpers";
import { getStripe } from "@/lib/stripe";
import { isCloud } from "@/lib/config";
import { db } from "@/lib/db";
import { subscriptions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  if (!isCloud()) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const auth = await withAuth();
  if (!auth.success) return auth.response;
  const { orgId, email } = auth.context;

  const priceId = process.env.STRIPE_PRO_PRICE_ID;
  if (!priceId) {
    return NextResponse.json(
      { error: "Stripe not configured" },
      { status: 500 }
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  try {
    const stripe = getStripe();

    // Check if subscription row already exists (user retrying checkout)
    const existing = await getOrgSubscription(orgId);
    let customerId: string;

    if (existing) {
      customerId = existing.stripeCustomerId;
    } else {
      const customer = await stripe.customers.create({
        email,
        metadata: { orgId },
      });
      customerId = customer.id;

      await db.insert(subscriptions).values({
        orgId,
        stripeCustomerId: customerId,
        plan: "trial",
        status: "incomplete",
      });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_update: { address: "auto" },
      mode: "subscription",
      automatic_tax: { enabled: true },
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 14,
      },
      success_url: `${appUrl}/knowledge-base?welcome=true`,
      cancel_url: `${appUrl}/subscribe`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
