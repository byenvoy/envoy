import { db } from "@/lib/db";
import { orgSkills } from "@/lib/db/schema";
import { and, eq, sql } from "drizzle-orm";

/**
 * Upsert an org skill overlay by (orgId, name). Increments version on conflict.
 * Safe to call on every settings save — renderers idempotently regenerate the
 * skill body from the source-of-truth settings columns.
 */
export async function upsertOrgSkill(params: {
  orgId: string;
  name: string;
  description: string;
  body: string;
  updatedByUserId?: string | null;
}): Promise<void> {
  await db
    .insert(orgSkills)
    .values({
      orgId: params.orgId,
      name: params.name,
      description: params.description,
      body: params.body,
      updatedByUserId: params.updatedByUserId ?? null,
    })
    .onConflictDoUpdate({
      target: [orgSkills.orgId, orgSkills.name],
      set: {
        description: params.description,
        body: params.body,
        version: sql`${orgSkills.version} + 1`,
        updatedAt: new Date(),
        updatedByUserId: params.updatedByUserId ?? null,
      },
    });
}

/** Delete an org skill overlay by (orgId, name). No-op if absent. */
export async function deleteOrgSkill(orgId: string, name: string): Promise<void> {
  await db
    .delete(orgSkills)
    .where(and(eq(orgSkills.orgId, orgId), eq(orgSkills.name, name)));
}
