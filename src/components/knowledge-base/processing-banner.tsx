"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface EmbeddingStatus {
  totalPages: number;
  embeddedPages: number;
  totalChunks: number;
}

interface ActiveJob {
  id: string;
  type: string;
  status: string;
  totalPages: number;
  pagesExtracted: number;
  pagesEmbedded: number;
}

export function ProcessingBanner() {
  const router = useRouter();
  const [embeddingStatus, setEmbeddingStatus] = useState<EmbeddingStatus | null>(null);
  const [activeJob, setActiveJob] = useState<ActiveJob | null>(null);
  const prevHadWork = useRef(false);

  useEffect(() => {
    async function poll() {
      try {
        const [embRes, jobRes] = await Promise.all([
          fetch("/api/embeddings/status"),
          fetch("/api/crawl/jobs/active"),
        ]);

        let job: ActiveJob | null = null;
        let emb: EmbeddingStatus | null = null;

        if (embRes.ok) {
          emb = await embRes.json();
          setEmbeddingStatus(emb);
        }

        if (jobRes.ok) {
          const data = await jobRes.json();
          job = data.job;
          setActiveJob(job);
        }

        // Determine if there's active work
        const hasWork =
          (job && (job.status === "pending" || job.status === "running")) ||
          (emb && emb.totalPages > 0 && emb.embeddedPages < emb.totalPages);

        // Refresh page data when work is happening so new pages appear
        if (hasWork) {
          router.refresh();
        }

        // If work just finished, do one final refresh to pick up the last pages
        if (!hasWork && prevHadWork.current) {
          router.refresh();
        }

        prevHadWork.current = !!hasWork;
      } catch {
        // Silently ignore polling errors
      }
    }

    poll();
    const timer = setInterval(poll, 3000);
    return () => clearInterval(timer);
  }, [router]);

  const isCrawling = activeJob && activeJob.status === "running" && activeJob.totalPages > 0;
  const isEmbedding =
    !isCrawling &&
    embeddingStatus &&
    embeddingStatus.totalPages > 0 &&
    embeddingStatus.embeddedPages < embeddingStatus.totalPages;

  if (!isCrawling && !isEmbedding && activeJob?.status !== "pending") return null;

  let label: string;
  let progress: string;
  let percent: number;

  if (activeJob?.status === "pending") {
    label = "Crawl queued...";
    progress = "Waiting for worker";
    percent = 0;
  } else if (isCrawling) {
    label = "Crawling your website...";
    progress = `${activeJob.pagesExtracted}/${activeJob.totalPages} pages`;
    percent = activeJob.totalPages > 0
      ? Math.round((activeJob.pagesExtracted / activeJob.totalPages) * 100)
      : 0;
  } else if (isEmbedding && embeddingStatus) {
    label = "Processing knowledge base...";
    progress = `${embeddingStatus.embeddedPages}/${embeddingStatus.totalPages} pages processed`;
    percent = embeddingStatus.totalPages > 0
      ? Math.round((embeddingStatus.embeddedPages / embeddingStatus.totalPages) * 100)
      : 0;
  } else {
    return null;
  }

  return (
    <div className="mb-6 rounded-lg border border-info bg-info-light p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg
            className="h-4 w-4 animate-spin text-info"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <p className="text-sm font-medium font-display text-info">
            {label}
          </p>
        </div>
        <p className="text-sm font-mono text-info">
          {progress}
        </p>
      </div>
      <div className="mt-2 h-1.5 w-full rounded-full bg-info-light">
        <div
          className="h-1.5 rounded-full bg-info transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
