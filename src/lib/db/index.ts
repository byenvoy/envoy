import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const client = postgres(process.env.DATABASE_URL!);

// Exported so advisory-lock helpers can reserve a dedicated connection —
// session-scoped locks must acquire and release on the same physical connection.
export { client };

export const db = drizzle(client, { schema });
