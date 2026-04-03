import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  timestamp,
  index,
  unique,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
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
    lastCrawledAt: timestamp("last_crawled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("knowledge_base_pages_org_url_unique").on(table.orgId, table.url),
    check(
      "knowledge_base_pages_source_check",
      sql`${table.source} IN ('crawled', 'manual', 'url', 'upload', 'notion', 'confluence')`
    ),
  ]
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

export const crawlJobs = pgTable(
  "crawl_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // "initial" | "recrawl"
    status: text("status").notNull().default("pending"), // "pending" | "running" | "completed" | "failed"
    urls: text("urls").array(),
    totalPages: integer("total_pages").notNull().default(0),
    pagesExtracted: integer("pages_extracted").notNull().default(0),
    pagesEmbedded: integer("pages_embedded").notNull().default(0),
    failedUrls: text("failed_urls").array(),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("crawl_jobs_status_idx").on(table.status),
    index("crawl_jobs_org_id_idx").on(table.orgId),
  ]
);
