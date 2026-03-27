import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

/**
 * Try to acquire a PostgreSQL advisory lock (non-blocking).
 * Returns true if the lock was acquired, false if already held.
 * Replaces the Supabase `try_advisory_lock` RPC function.
 */
export async function tryAdvisoryLock(lockId: number): Promise<boolean> {
  const result = await db.execute(
    sql`SELECT pg_try_advisory_lock(${lockId})`
  );
  const row = result[0] as { pg_try_advisory_lock: boolean } | undefined;
  return row?.pg_try_advisory_lock ?? false;
}

/**
 * Release a PostgreSQL advisory lock.
 * Replaces the Supabase `advisory_unlock` RPC function.
 */
export async function advisoryUnlock(lockId: number): Promise<void> {
  await db.execute(sql`SELECT pg_advisory_unlock(${lockId})`);
}
