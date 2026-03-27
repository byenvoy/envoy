import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";

export interface AuthContext {
  userId: string;
  email: string;
  orgId: string;
  role: string;
  fullName: string | null;
}

type AuthResult =
  | { success: true; context: AuthContext }
  | { success: false; response: NextResponse };

/**
 * Authenticate the current request and return the user's org context.
 * Uses Better Auth for session validation and Drizzle for profile lookup.
 */
export async function withAuth(): Promise<AuthResult> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return {
      success: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const profile = await db
    .select({
      orgId: profiles.orgId,
      role: profiles.role,
      fullName: profiles.fullName,
    })
    .from(profiles)
    .where(eq(profiles.id, session.user.id))
    .then((rows) => rows[0]);

  if (!profile) {
    return {
      success: false,
      response: NextResponse.json({ error: "Profile not found" }, { status: 404 }),
    };
  }

  return {
    success: true,
    context: {
      userId: session.user.id,
      email: session.user.email,
      orgId: profile.orgId,
      role: profile.role,
      fullName: profile.fullName,
    },
  };
}
