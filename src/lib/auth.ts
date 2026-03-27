import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { createAuthMiddleware } from "better-auth/api";
import { db } from "@/lib/db";
import { organizations, profiles } from "@/lib/db/schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // TODO: enable once Resend is wired up
    sendResetPassword: async ({ user, url }) => {
      // TODO: wire up Resend for production
      console.log(`[auth] Password reset for ${user.email}: ${url}`);
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      // TODO: wire up Resend for production
      console.log(`[auth] Verification email for ${user.email}: ${url}`);
    },
  },
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path.startsWith("/sign-up")) {
        const newSession = ctx.context.newSession;
        if (newSession) {
          const companyName =
            (ctx.body as Record<string, unknown>)?.companyName as string | undefined;

          // Create organization + profile for the new user
          const [org] = await db
            .insert(organizations)
            .values({
              name: companyName || "My Organization",
            })
            .returning({ id: organizations.id });

          await db.insert(profiles).values({
            id: newSession.user.id,
            orgId: org.id,
            fullName: newSession.user.name,
            role: "owner",
          });
        }
      }
    }),
  },
  plugins: [nextCookies()],
});
