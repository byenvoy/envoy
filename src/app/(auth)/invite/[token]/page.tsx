import { db } from "@/lib/db";
import { teamInvites, organizations } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { InviteSignupForm } from "@/components/auth/invite-signup-form";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // If already logged in, send them to the API route to accept
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (session) {
    redirect(`/api/invite/${token}`);
  }

  // Look up the invite
  const invite = await db
    .select({
      email: teamInvites.email,
      role: teamInvites.role,
      expiresAt: teamInvites.expiresAt,
      orgId: teamInvites.orgId,
    })
    .from(teamInvites)
    .where(and(eq(teamInvites.token, token), isNull(teamInvites.acceptedAt)))
    .then((r) => r[0]);

  if (!invite) {
    return (
      <div className="text-center">
        <h1 className="mb-2 text-2xl font-semibold tracking-tight text-text-primary">
          Invalid invitation
        </h1>
        <p className="text-sm text-text-secondary">
          This invite link is invalid or has already been used.
        </p>
      </div>
    );
  }

  if (new Date(invite.expiresAt) < new Date()) {
    return (
      <div className="text-center">
        <h1 className="mb-2 text-2xl font-semibold tracking-tight text-text-primary">
          Invitation expired
        </h1>
        <p className="text-sm text-text-secondary">
          This invite has expired. Please ask your team to send a new one.
        </p>
      </div>
    );
  }

  const org = await db
    .select({ name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, invite.orgId))
    .then((r) => r[0]);

  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold tracking-tight text-text-primary">
        Join {org?.name ?? "your team"}
      </h1>
      <p className="mb-8 text-sm text-text-secondary">
        Create an account to join as {invite.role === "owner" ? "an owner" : "an agent"}.
      </p>
      <InviteSignupForm
        email={invite.email}
        token={token}
      />
    </div>
  );
}
