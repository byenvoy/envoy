import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { profiles, organizations, subscriptions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { isCloud } from "@/lib/stripe";
import { isActiveSubscription } from "@/lib/db/helpers";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  // Get user profile for initials and onboarding check
  const profile = await db
    .select({
      fullName: profiles.fullName,
      orgId: profiles.orgId,
    })
    .from(profiles)
    .where(eq(profiles.id, session.user.id))
    .then((rows) => rows[0]);

  // Check onboarding status
  if (profile) {
    const org = await db
      .select({ onboardingCompletedAt: organizations.onboardingCompletedAt })
      .from(organizations)
      .where(eq(organizations.id, profile.orgId))
      .then((rows) => rows[0]);

    if (org && !org.onboardingCompletedAt) {
      redirect("/onboarding");
    }

    // On cloud: redirect to /subscribe if no active subscription
    if (isCloud() && org?.onboardingCompletedAt) {
      const sub = await db
        .select({ status: subscriptions.status })
        .from(subscriptions)
        .where(eq(subscriptions.orgId, profile.orgId))
        .then((r) => r[0] ?? null);

      if (!sub || !isActiveSubscription(sub.status)) {
        redirect("/subscribe");
      }
    }
  }

  const fullName = profile?.fullName ?? session.user.email ?? "";
  const initials = fullName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || session.user.email?.[0]?.toUpperCase() || "?";

  return (
    <DashboardShell
      userInitials={initials}
      userName={fullName}
      userEmail={session.user.email ?? ""}
    >
      {children}
    </DashboardShell>
  );
}
