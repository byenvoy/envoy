import { NextRequest, NextResponse } from "next/server";
import { withAuth, getOrgSubscription } from "@/lib/db/helpers";
import { getStripe, isCloud } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  if (!isCloud()) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const auth = await withAuth();
  if (!auth.success) return auth.response;
  const { orgId, role } = auth.context;

  if (role !== "owner") {
    return NextResponse.json(
      { error: "Only owners can manage billing" },
      { status: 403 }
    );
  }

  const sub = await getOrgSubscription(orgId);
  if (!sub) {
    return NextResponse.json(
      { error: "No subscription found" },
      { status: 404 }
    );
  }

  const priceId = process.env.STRIPE_PRO_PRICE_ID;
  if (!priceId) {
    return NextResponse.json(
      { error: "Stripe not configured" },
      { status: 500 }
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  try {
    const session = await getStripe().checkout.sessions.create({
      customer: sub.stripeCustomerId,
      mode: "subscription",
      automatic_tax: { enabled: true },
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/settings?billing=success`,
      cancel_url: `${appUrl}/settings?billing=canceled`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
