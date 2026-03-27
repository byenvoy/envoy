import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { sql } from "drizzle-orm";

export const conversationStatusEnum = pgEnum("conversation_status", [
  "open",
  "waiting",
  "closed",
]);

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    subject: text("subject"),
    status: conversationStatusEnum("status").notNull().default("open"),
    customerEmail: text("customer_email").notNull(),
    customerName: text("customer_name"),
    autopilotDisabled: boolean("autopilot_disabled").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("conversations_org_id").on(table.orgId),
    index("conversations_org_status").on(table.orgId, table.status),
    index("conversations_org_updated").on(table.orgId, sql`${table.updatedAt} desc`),
  ]
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    direction: text("direction").notNull(),
    fromEmail: text("from_email").notNull(),
    fromName: text("from_name"),
    toEmail: text("to_email").notNull(),
    bodyText: text("body_text"),
    bodyHtml: text("body_html"),
    messageId: text("message_id"),
    inReplyTo: text("in_reply_to"),
    source: text("source").notNull().default("imap"),
    connectionId: uuid("connection_id"),
    sentByAutopilot: boolean("sent_by_autopilot").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("messages_conversation_id").on(table.conversationId),
    index("messages_org_id").on(table.orgId),
    index("messages_message_id").on(table.messageId),
    index("messages_conversation_created").on(table.conversationId, table.createdAt),
  ]
);

export const drafts = pgTable(
  "drafts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    messageId: uuid("message_id"),
    draftContent: text("draft_content").notNull(),
    editedContent: text("edited_content"),
    status: text("status").notNull().default("pending"),
    modelUsed: text("model_used"),
    chunksUsed: jsonb("chunks_used"),
    customerContext: jsonb("customer_context"),
    classificationResult: jsonb("classification_result"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvedBy: text("approved_by"),
    autopilotEvaluationId: uuid("autopilot_evaluation_id"),
    sentByAutopilot: boolean("sent_by_autopilot").notNull().default(false),
    isRegeneration: boolean("is_regeneration").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("drafts_conversation_id").on(table.conversationId),
    index("drafts_org_id").on(table.orgId),
  ]
);
