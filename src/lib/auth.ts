import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { createAuthMiddleware } from "better-auth/api";
import { Resend } from "resend";
import { db } from "@/lib/db";
import { organizations, profiles } from "@/lib/db/schema";
import { user as userTable } from "@/lib/db/schema/auth";
import { eq } from "drizzle-orm";

let _resend: Resend | null = null;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}
const fromEmail = process.env.RESEND_FROM_EMAIL ?? "Envoy <onboarding@resend.dev>";

// Track invite signups so we can skip sending them the verification email.
// The before hook adds emails here; sendVerificationEmail checks and removes them.
const inviteSignupEmails = new Set<string>();

// Stash companyName from the signup request so the databaseHooks user.create.after
// hook can access it (databaseHooks don't have access to the HTTP request body).
const pendingCompanyNames = new Map<string, string>();

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      void getResend().emails.send({
        from: fromEmail,
        to: user.email,
        subject: "Reset your password",
        html: `<p>Click the link below to reset your password:</p><p><a href="${url}">Reset Password</a></p><p>If you didn't request this, you can safely ignore this email.</p>`,
      });
    },
  },
  emailVerification: {
    autoSignInAfterVerification: true,
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      // Skip sending for invite signups — they're already verified
      if (inviteSignupEmails.delete(user.email)) return;

      void getResend().emails.send({
        from: fromEmail,
        to: user.email,
        subject: "Verify your email address",
        html: `<p>Click the link below to verify your email:</p><p><a href="${url}">Verify Email</a></p>`,
      });
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/sign-up/email") {
        const body = ctx.body as Record<string, unknown> | undefined;
        const callbackURL = body?.callbackURL as string | undefined;
        const email = body?.email as string | undefined;
        if (callbackURL?.startsWith("/api/invite/") && email) {
          inviteSignupEmails.add(email);
        }
        // Stash companyName so databaseHooks can access it
        if (body?.companyName && body?.email) {
          pendingCompanyNames.set(body.email as string, body.companyName as string);
        }
      }
    }),
    after: createAuthMiddleware(async (ctx) => {
      // Handle invite signups: mark email as verified
      if (ctx.path === "/sign-up/email") {
        const body = ctx.body as Record<string, unknown> | undefined;
        const callbackURL = body?.callbackURL as string | undefined;

        if (callbackURL?.startsWith("/api/invite/")) {
          const response = ctx.context.returned as Record<string, unknown> | null;
          const inviteUser = response?.user as Record<string, unknown> | undefined;
          const inviteUserId = inviteUser?.id as string | undefined;
          if (inviteUserId) {
            await db
              .update(userTable)
              .set({ emailVerified: true })
              .where(eq(userTable.id, inviteUserId));
          }
        }
      }
    }),
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // Skip org+profile creation for invite signups (handled by invite acceptance route)
          if (inviteSignupEmails.has(user.email)) return;

          // Idempotency check
          const existing = await db
            .select({ id: profiles.id })
            .from(profiles)
            .where(eq(profiles.id, user.id))
            .then((r) => r[0]);
          if (existing) return;

          const companyName = pendingCompanyNames.get(user.email);
          pendingCompanyNames.delete(user.email);

          const [org] = await db
            .insert(organizations)
            .values({ name: companyName || "My Organization" })
            .returning({ id: organizations.id });

          await db.insert(profiles).values({
            id: user.id,
            orgId: org.id,
            fullName: user.name ?? "",
            role: "owner",
          });
        },
      },
    },
  },
  rateLimit: {
    window: 60,
    max: 100,
    customRules: {
      "/sign-up/email": { window: 60, max: 3 },
      "/sign-in/email": { window: 10, max: 5 },
      "/forgot-password": { window: 60, max: 3 },
      "/reset-password": { window: 60, max: 5 },
      "/verify-email": { window: 60, max: 5 },
      "/get-session": false,
    },
  },
  plugins: [nextCookies()],
});
