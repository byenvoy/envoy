import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageList } from "@/components/knowledge-base/page-list";
import { ProcessingBanner } from "@/components/knowledge-base/processing-banner";
import { GettingStartedChecklist } from "@/components/knowledge-base/getting-started-checklist";
import type { KnowledgeBasePage } from "@/lib/types/database";

export default async function KnowledgeBasePage() {
  const supabase = await createClient();

  const { data: pages } = await supabase
    .from("knowledge_base_pages")
    .select("*")
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .returns<KnowledgeBasePage[]>();

  const { count: chunkCount } = await supabase
    .from("knowledge_base_chunks")
    .select("*", { count: "exact", head: true });

  const hasPages = pages && pages.length > 0;
  const sources = new Set((pages ?? []).map((p) => p.source));

  return (
    <div>
      <ProcessingBanner />
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Knowledge Base
          </h1>
          {hasPages && (
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {pages.length} page{pages.length === 1 ? "" : "s"} indexed
              {chunkCount != null && chunkCount > 0 && (
                <span>
                  {" "}
                  &middot; {chunkCount} chunk{chunkCount === 1 ? "" : "s"}{" "}
                  embedded
                </span>
              )}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/knowledge-base/upload"
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Upload File
          </Link>
          <Link
            href="/knowledge-base/new-url"
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Add URL
          </Link>
          <Link
            href="/knowledge-base/new"
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Manual Entry
          </Link>
          <Link
            href="/knowledge-base/crawl"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Crawl Website
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
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 py-16 dark:border-zinc-700">
            <p className="mb-1 text-sm font-medium text-zinc-900 dark:text-zinc-50">
              No pages yet
            </p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Use the checklist above to start adding content.
            </p>
          </div>
        )
      )}
    </div>
  );
}
