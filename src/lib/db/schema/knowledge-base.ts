import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  timestamp,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { vector1536 } from "./columns";

export const knowledgeBasePages = pgTable(
  "knowledge_base_pages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    url: text("url"),
    title: text("title"),
    markdownContent: text("markdown_content"),
    contentHash: text("content_hash"),
    isActive: boolean("is_active").notNull().default(true),
    source: text("source").notNull().default("crawled"),
    etag: text("etag"),
    lastModifiedHeader: text("last_modified_header"),
    lastRecrawledAt: timestamp("last_recrawled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("knowledge_base_pages_org_url_unique").on(table.orgId, table.url)]
);

export const knowledgeBaseChunks = pgTable(
  "knowledge_base_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pageId: uuid("page_id")
      .notNull()
      .references(() => knowledgeBasePages.id, { onDelete: "cascade" }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    tokenCount: integer("token_count").notNull(),
    embedding: vector1536("embedding"),
    contentHash: text("content_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("knowledge_base_chunks_page_id_idx").on(table.pageId),
    index("knowledge_base_chunks_org_id_idx").on(table.orgId),
  ]
);
