import { eq, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

/**
 * Returns an `eq(table.orgId, orgId)` condition for org-scoped queries.
 * Use this instead of raw `eq()` to ensure consistent org filtering.
 */
export function orgEq(orgIdColumn: PgColumn, orgId: string): SQL {
  return eq(orgIdColumn, orgId);
}
