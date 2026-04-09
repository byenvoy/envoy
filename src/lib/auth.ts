import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { createAuthMiddleware } from "better-auth/api";
import { Resend } from "resend";
import { db } from "@/lib/db";
import { organizations, profiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const resend = new Resend(process.env.RESEND_API_KEY);
const fromEmail = process.env.RESEND_FROM_EMAIL ?? "Envoy <onboarding@resend.dev>";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      void resend.emails.send({
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
      void resend.emails.send({
        from: fromEmail,
        to: user.email,
        subject: "Verify your email address",
        html: `<p>Click the link below to verify your email:</p><p><a href="${url}">Verify Email</a></p>`,
      });
    },
  },
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      // Create org + profile after signup.
      // With requireEmailVerification, newSession is null — read the user
      // from the response body instead.
      if (ctx.path === "/sign-up/email") {
        const body = ctx.body as Record<string, unknown> | undefined;
        const companyName = body?.companyName as string | undefined;

        // Better Auth returns a plain object { token, user } from the signup endpoint
        const response = ctx.context.returned as Record<string, unknown> | null;
        const user = response?.user as Record<string, unknown> | undefined;
        const userId = user?.id as string | undefined;
        const userName = user?.name as string | undefined;
        if (!userId) return;

        // Idempotency check
        const existing = await db
          .select({ id: profiles.id })
          .from(profiles)
          .where(eq(profiles.id, userId))
          .then((r) => r[0]);
        if (existing) return;

        const [org] = await db
          .insert(organizations)
          .values({ name: companyName || "My Organization" })
          .returning({ id: organizations.id });

        await db.insert(profiles).values({
          id: userId,
          orgId: org.id,
          fullName: userName ?? "",
          role: "owner",
        });
      }
    }),
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
