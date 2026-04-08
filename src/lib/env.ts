/**
 * Validate required environment variables at startup.
 * Imported by instrumentation.ts so it runs once on server start.
 */

const REQUIRED = [
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
  "ENCRYPTION_KEY",
  "CRON_SECRET",
] as const;

const RECOMMENDED = [
  "NEXT_PUBLIC_APP_URL",
  "OPENAI_API_KEY",
] as const;

export function validateEnv() {
  const missing: string[] = [];

  for (const key of REQUIRED) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    console.error(
      `\n❌ Missing required environment variables:\n${missing.map((k) => `   - ${k}`).join("\n")}\n\nSee .env.example for reference.\n`
    );
    process.exit(1);
  }

  for (const key of RECOMMENDED) {
    if (!process.env[key]) {
      console.warn(`⚠️  ${key} is not set. Some features may not work correctly.`);
    }
  }

  // Warn about localhost fallback in production
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (
    process.env.NODE_ENV === "production" &&
    (!appUrl || appUrl.includes("localhost"))
  ) {
    console.warn(
      "⚠️  NEXT_PUBLIC_APP_URL is not set or points to localhost. OAuth callbacks and email links will not work in production."
    );
  }
}
