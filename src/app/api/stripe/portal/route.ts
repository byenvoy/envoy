import { NextRequest, NextResponse } from "next/server";
import { withAuth, getOrgSubscription } from "@/lib/db/helpers";
import { getStripe } from "@/lib/stripe";
import { isCloud } from "@/lib/config";
import { requireOwner } from "@/lib/permissions";

export async function POST(request: NextRequest) {
  if (!isCloud()) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const auth = await withAuth();
  if (!auth.success) return auth.response;
  const { orgId, role } = auth.context;

  const denied = requireOwner(role);
  if (denied) return denied;

  const sub = await getOrgSubscription(orgId);
  if (!sub) {
    return NextResponse.json(
      { error: "No subscription found" },
      { status: 404 }
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${appUrl}/settings`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
