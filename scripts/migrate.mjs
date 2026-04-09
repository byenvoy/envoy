import { fileURLToPath } from "url";
import path from "path";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const client = postgres(process.env.DATABASE_URL, { max: 1 });
const db = drizzle(client);

console.log("Running migrations...");
await migrate(db, { migrationsFolder: path.join(__dirname, "..", "drizzle") });
console.log("Migrations complete.");

await client.end();
