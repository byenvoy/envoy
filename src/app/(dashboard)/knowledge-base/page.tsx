import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { profiles, knowledgeBasePages, knowledgeBaseChunks } from "@/lib/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { PageList } from "@/components/knowledge-base/page-list";
import { ProcessingBanner } from "@/components/knowledge-base/processing-banner";
import { GettingStartedChecklist } from "@/components/knowledge-base/getting-started-checklist";
import type { KnowledgeBasePage } from "@/lib/types/database";

export default async function KnowledgeBasePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const profile = await db
    .select({ orgId: profiles.orgId })
    .from(profiles)
    .where(eq(profiles.id, session.user.id))
    .then((r) => r[0]);

  if (!profile) redirect("/onboarding");

  const [pageRows, chunkCountResult] = await Promise.all([
    db
      .select()
      .from(knowledgeBasePages)
      .where(
        and(
          eq(knowledgeBasePages.orgId, profile.orgId),
          eq(knowledgeBasePages.isActive, true)
        )
      )
      .orderBy(desc(knowledgeBasePages.updatedAt)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(knowledgeBaseChunks)
      .where(eq(knowledgeBaseChunks.orgId, profile.orgId))
      .then((r) => Number(r[0]?.count ?? 0)),
  ]);

  // Map to snake_case for component compatibility
  const pages = pageRows.map((p) => ({
    id: p.id,
    org_id: p.orgId,
    url: p.url,
    title: p.title,
    source: p.source,
    markdown_content: p.markdownContent,
    content_hash: p.contentHash,
    is_active: p.isActive,
    last_crawled_at: p.lastCrawledAt?.toISOString() ?? null,
    created_at: p.createdAt.toISOString(),
    updated_at: p.updatedAt.toISOString(),
  })) as KnowledgeBasePage[];

  const chunkCount = chunkCountResult;

  const hasPages = pages.length > 0;
  const sources = new Set(pages.map((p) => p.source));

  return (
    <div>
      <ProcessingBanner />
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display tracking-tight text-text-primary">
            Knowledge Base
          </h1>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-3">
          <Link
            href="/knowledge-base/upload"
            className="rounded-lg border border-border px-4 py-2 text-center text-sm font-medium font-display text-text-secondary transition-colors hover:bg-surface"
          >
            Upload File
          </Link>
          <Link
            href="/knowledge-base/new-url"
            className="rounded-lg border border-border px-4 py-2 text-center text-sm font-medium font-display text-text-secondary transition-colors hover:bg-surface"
          >
            Add URL
          </Link>
          <Link
            href="/knowledge-base/new"
            className="rounded-lg border border-border px-4 py-2 text-center text-sm font-medium font-display text-text-secondary transition-colors hover:bg-surface"
          >
            Manual Entry
          </Link>
          <Link
            href="/knowledge-base/crawl"
            className="rounded-lg bg-primary px-4 py-2 text-center text-sm font-medium font-display text-white transition-colors hover:bg-primary-dark"
          >
            Import Site
          </Link>
        </div>
      </div>

      <GettingStartedChecklist
        hasCrawled={sources.has("crawled")}
        hasUrl={sources.has("url")}
        hasUpload={sources.has("upload")}
        hasManual={sources.has("manual")}
      />

      {hasPages ? (
        <PageList pages={pages} />
      ) : (
        !sources.size && (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16">
            <p className="mb-1 text-sm font-medium font-display text-text-primary">
              No pages yet
            </p>
            <p className="text-sm text-text-secondary">
              Use the checklist above to start adding content.
            </p>
          </div>
        )
      )}
    </div>
  );
}
