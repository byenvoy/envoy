import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set. Ensure .env.local is loaded (try: node --env-file=.env.local scripts/wipe-dev-db.mjs)");
  process.exit(1);
}

// Safety: refuse to run against anything that isn't obviously a local dev DB.
const isLocal =
  url.includes("@localhost") ||
  url.includes("@127.0.0.1") ||
  url.includes("@db:") ||
  url.includes("@host.docker.internal");

if (!isLocal) {
  console.error(`Refusing to wipe non-local database. DATABASE_URL host must be localhost / 127.0.0.1 / db / host.docker.internal.`);
  console.error(`Got: ${url.replace(/:[^:@]+@/, ":***@")}`);
  process.exit(1);
}

const KEEP_USER = process.argv.includes("--keep-user");

// App-data tables. With KEEP_USER, only these are wiped — useful when
// iterating on the email/Gmail OAuth flow without re-doing signup.
const APP_TABLES = [
  "messages",
  "drafts",
  "conversations",
  "autopilot_evaluations",
  "autopilot_topics",
  "usage_logs",
  "team_invites",
  "org_api_keys",
  "integrations",
  "email_addresses",
  "email_connections",
  "knowledge_base_chunks",
  "knowledge_base_pages",
  "crawl_jobs",
  "subscriptions",
];

// Auth + tenant tables. Wiped only on a full reset.
const ROOT_TABLES = [
  "profiles",
  "organizations",
  "session",
  "account",
  "verification",
  "user",
];

const tables = KEEP_USER ? APP_TABLES : [...APP_TABLES, ...ROOT_TABLES];

const client = postgres(url, { max: 1 });

try {
  // Single TRUNCATE with CASCADE handles FK ordering for us.
  const quoted = tables.map((t) => `"${t}"`).join(", ");
  await client.unsafe(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`);
  console.log(`Wiped ${tables.length} tables${KEEP_USER ? " (kept user/auth)" : ""}.`);
} catch (err) {
  console.error("Wipe failed:", err.message);
  process.exit(1);
} finally {
  await client.end();
}
