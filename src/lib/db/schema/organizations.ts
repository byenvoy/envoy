import { pgTable, uuid, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  domain: text("domain").unique(),
  preferredModel: text("preferred_model"),
  tone: text("tone").notNull().default("professional"),
  customInstructions: text("custom_instructions"),
  greetingTemplate: text("greeting_template"),
  signOff: text("sign_off"),
  llmErrorMessage: text("llm_error_message"),
  llmErrorAt: timestamp("llm_error_at", { withTimezone: true }),
  pollingEnabled: boolean("polling_enabled").notNull().default(false),
  onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true }),
  onboardingStep: integer("onboarding_step").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
