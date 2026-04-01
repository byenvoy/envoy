import { pgTable, text, uuid, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { organizations } from "./organizations";

export const profiles = pgTable("profiles", {
  id: text("id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  fullName: text("full_name"),
  role: text("role").notNull().default("owner"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
