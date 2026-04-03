"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

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
  const [activeJob, setActiveJob] = useState<ActiveJob | null>(null);
  const prevHadWork = useRef(false);

  useEffect(() => {
    async function poll() {
      try {
        const res = await fetch("/api/crawl/jobs/active");
        if (!res.ok) return;

        const data = await res.json();
        // Only show banner for initial/recrawl jobs, not per-page resyncs
        const bannerJob = (data.jobs ?? []).find(
          (j: ActiveJob) =>
            j.type !== "resync" &&
            (j.status === "pending" || j.status === "running")
        ) ?? null;
        setActiveJob(bannerJob);

        const hasWork = !!bannerJob;

        if (hasWork) {
          router.refresh();
        }

        if (!hasWork && prevHadWork.current) {
          router.refresh();
        }

        prevHadWork.current = hasWork;
      } catch {
        // Silently ignore polling errors
      }
    }

    poll();
    const timer = setInterval(poll, 3000);
    return () => clearInterval(timer);
  }, [router]);

  if (!activeJob || (activeJob.status !== "pending" && activeJob.status !== "running")) {
    return null;
  }

  const percent = activeJob.totalPages > 0
    ? Math.round((activeJob.pagesEmbedded / activeJob.totalPages) * 100)
    : 0;

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
            Syncing knowledge base...
          </p>
        </div>
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
