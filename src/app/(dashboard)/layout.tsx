import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { profiles, organizations, subscriptions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { isCloud } from "@/lib/config";
import { isActiveSubscription } from "@/lib/db/helpers";
import type { Role } from "@/lib/permissions";

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
      role: profiles.role,
    })
    .from(profiles)
    .where(eq(profiles.id, session.user.id))
    .then((rows) => rows[0]);

  let subscriptionStatus: string | null = null;

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

    // On cloud: check subscription status
    if (isCloud() && org?.onboardingCompletedAt) {
      const sub = await db
        .select({ status: subscriptions.status })
        .from(subscriptions)
        .where(eq(subscriptions.orgId, profile.orgId))
        .then((r) => r[0] ?? null);

      // No subscription row at all — first-time user who skipped checkout
      if (!sub) {
        redirect("/subscribe");
      }

      // Subscription exists but inactive — pass status to shell for banner
      if (sub && !isActiveSubscription(sub.status)) {
        subscriptionStatus = sub.status;
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
      userRole={(profile?.role ?? "agent") as Role}
      subscriptionStatus={subscriptionStatus}
    >
      {children}
    </DashboardShell>
  );
}
