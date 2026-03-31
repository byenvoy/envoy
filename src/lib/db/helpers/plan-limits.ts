import { db } from "@/lib/db";
import { subscriptions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function getOrgSubscription(orgId: string) {
  return db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.orgId, orgId))
    .then((r) => r[0] ?? null);
}

export function isActiveSubscription(status: string): boolean {
  return ["trialing", "active", "past_due"].includes(status);
}
