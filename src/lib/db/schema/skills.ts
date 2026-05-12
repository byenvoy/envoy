import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { user } from "./auth";

/**
 * Per-organization skill overlays for the agent pipeline.
 *
 * Core skills live in the repo at `src/skills/core/`. Rows here override
 * core skills with the same `name` for a specific org (last-write-wins
 * inside `loadSkills`). Used for org-specific voice, autopilot topic rules,
 * and any future authored overrides.
 *
 * Bodies are markdown that the agent reads via the `read_skill` tool
 * (progressive disclosure). Descriptions are surfaced upfront in the
 * agent's system prompt so the model knows what to load.
 */
export const orgSkills = pgTable(
  "org_skills",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull(),
    body: text("body").notNull(),
    version: integer("version").notNull().default(1),
    updatedByUserId: text("updated_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("org_skills_org_name_unique").on(table.orgId, table.name),
    index("org_skills_org_id").on(table.orgId),
  ]
);
