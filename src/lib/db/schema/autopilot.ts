import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  numeric,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { conversations } from "./conversations";
import { vector1536 } from "./columns";

export const autopilotTopics = pgTable(
  "autopilot_topics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull(),
    embedding: vector1536("embedding"),
    mode: text("mode").notNull().default("off"),
    confidenceThreshold: numeric("confidence_threshold").notNull().default("0.95"),
    dailySendLimit: integer("daily_send_limit").notNull().default(100),
    dailySendsToday: integer("daily_sends_today").notNull().default(0),
    dailySendsResetAt: timestamp("daily_sends_reset_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("autopilot_topics_org_id").on(table.orgId),
    index("autopilot_topics_org_mode").on(table.orgId, table.mode),
  ]
);

export const autopilotEvaluations = pgTable(
  "autopilot_evaluations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    draftId: uuid("draft_id"),

    // Gate 1: Topic Classification
    gate1Passed: boolean("gate1_passed"),
    gate1TopicId: uuid("gate1_topic_id"),
    gate1TopicName: text("gate1_topic_name"),
    gate1Confidence: numeric("gate1_confidence"),
    gate1EmbeddingSimilarity: numeric("gate1_embedding_similarity"),
    gate1Reasoning: text("gate1_reasoning"),

    // Gate 2: Retrieval Quality
    gate2Passed: boolean("gate2_passed"),
    gate2Confidence: numeric("gate2_confidence"),
    gate2Reasoning: text("gate2_reasoning"),

    // Gate 3: Generation Escape Hatch
    gate3Passed: boolean("gate3_passed"),
    gate3NeedsHumanReason: text("gate3_needs_human_reason"),

    // Gate 4: Post-Generation Validation
    gate4Passed: boolean("gate4_passed"),
    gate4Confidence: numeric("gate4_confidence"),
    gate4Checks: jsonb("gate4_checks"),
    gate4Reasoning: text("gate4_reasoning"),

    // Outcome
    allGatesPassed: boolean("all_gates_passed").notNull().default(false),
    outcome: text("outcome").notNull().default("human_queue"),
    failureGate: integer("failure_gate"),

    // Model tracking
    gateModel: text("gate_model"),
    generationModel: text("generation_model"),

    // Shadow mode tracking
    humanAction: text("human_action"),
    editDistance: integer("edit_distance"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("autopilot_evaluations_org_id").on(table.orgId),
    index("autopilot_evaluations_conversation_id").on(table.conversationId),
    index("autopilot_evaluations_topic_id").on(table.gate1TopicId),
    index("autopilot_evaluations_org_outcome").on(table.orgId, table.outcome),
  ]
);
