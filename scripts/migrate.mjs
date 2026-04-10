import { fileURLToPath } from "url";
import path from "path";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAX_RETRIES = 10;
const RETRY_DELAY_MS = 5000;

for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
  try {
    const client = postgres(process.env.DATABASE_URL, { max: 1, connect_timeout: 10 });
    const db = drizzle(client);

    console.log(`Running migrations (attempt ${attempt}/${MAX_RETRIES})...`);
    await migrate(db, { migrationsFolder: path.join(__dirname, "..", "drizzle") });
    console.log("Migrations complete.");

    await client.end();
    process.exit(0);
  } catch (err) {
    console.error(`Migration attempt ${attempt} failed:`, err.message);
    if (attempt < MAX_RETRIES) {
      console.log(`Retrying in ${RETRY_DELAY_MS / 1000}s...`);
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    } else {
      console.error("All migration attempts failed.");
      process.exit(1);
    }
  }
}
