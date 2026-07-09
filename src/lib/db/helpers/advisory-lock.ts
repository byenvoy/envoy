import { client } from "@/lib/db";

/**
 * A held advisory lock. Call release() exactly once (typically in a finally
 * block) to unlock and return the underlying connection to the pool.
 */
export interface AdvisoryLock {
  release(): Promise<void>;
}

/**
 * Try to acquire a PostgreSQL session-level advisory lock (non-blocking).
 *
 * `pg_try_advisory_lock` / `pg_advisory_unlock` are scoped to the Postgres
 * *session* (connection) that ran them. With a connection pool, every query
 * lands on an arbitrary pooled connection — so acquiring on one connection and
 * unlocking on another makes the unlock a silent no-op and leaks the lock,
 * while a second caller can acquire the "same" lock on a different session and
 * defeat the mutual exclusion entirely.
 *
 * To make the lock actually serialize, we reserve one dedicated connection and
 * run both the acquire and the release on it, holding it for the lock's whole
 * lifetime.
 *
 * Returns an AdvisoryLock handle if acquired, or null if the lock is already
 * held. The caller MUST call release() when done (use try/finally).
 */
export async function tryAdvisoryLock(
  lockId: number
): Promise<AdvisoryLock | null> {
  const connection = await client.reserve();
  try {
    const [row] = await connection<{ locked: boolean }[]>`
      SELECT pg_try_advisory_lock(${lockId}) AS locked
    `;
    if (!row?.locked) {
      connection.release();
      return null;
    }
  } catch (err) {
    connection.release();
    throw err;
  }

  let released = false;
  return {
    async release() {
      if (released) return;
      released = true;
      try {
        await connection`SELECT pg_advisory_unlock(${lockId})`;
      } finally {
        connection.release();
      }
    },
  };
}
