import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { profiles, organizations, subscriptions, emailConnections } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { isCloud } from "@/lib/config";
import { isActiveSubscription } from "@/lib/db/helpers";
import type { Role } from "@/lib/permissions";

const AUTH_ERROR_PATTERN = /401|403|invalid_grant|invalid_token|invalid_scope|authentication\s*failed|token refresh failed|unauthorized|permission denied/i;

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
  let llmErrorMessage: string | null = null;
  let emailConnectionErrored = false;
  let emailConnectionNeedsReconnect = false;

  // Check onboarding status
  if (profile) {
    const org = await db
      .select({
        onboardingCompletedAt: organizations.onboardingCompletedAt,
        llmErrorMessage: organizations.llmErrorMessage,
      })
      .from(organizations)
      .where(eq(organizations.id, profile.orgId))
      .then((rows) => rows[0]);

    if (org && !org.onboardingCompletedAt) {
      redirect("/onboarding");
    }

    llmErrorMessage = org?.llmErrorMessage ?? null;

    // Look up any errored email connections for this org
    const erroredConn = await db
      .select({ errorMessage: emailConnections.errorMessage })
      .from(emailConnections)
      .where(
        and(
          eq(emailConnections.orgId, profile.orgId),
          eq(emailConnections.status, "error")
        )
      )
      .limit(1)
      .then((r) => r[0] ?? null);

    if (erroredConn) {
      emailConnectionErrored = true;
      emailConnectionNeedsReconnect = !!erroredConn.errorMessage &&
        AUTH_ERROR_PATTERN.test(erroredConn.errorMessage);
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
      llmErrorMessage={llmErrorMessage}
      emailConnectionErrored={emailConnectionErrored}
      emailConnectionNeedsReconnect={emailConnectionNeedsReconnect}
    >
      {children}
    </DashboardShell>
  );
}
