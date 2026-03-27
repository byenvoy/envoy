import { pgTable, text, uuid, timestamp } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

export const profiles = pgTable("profiles", {
  // ID matches the Better Auth user.id — no FK constraint due to
  // type mismatch (Better Auth uses text, we use text here to match).
  // Relationship enforced at app layer via withAuth().
  id: text("id").primaryKey(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  fullName: text("full_name"),
  role: text("role").notNull().default("owner"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
