"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface ActiveJob {
  type: string;
  status: string;
  urls: string[] | null;
}

export function useSyncingUrls(): Set<string> {
  const router = useRouter();
  const [syncingUrls, setSyncingUrls] = useState<Set<string>>(new Set());
  const prevHadSyncing = useRef(false);

  useEffect(() => {
    async function poll() {
      try {
        const res = await fetch("/api/crawl/jobs/active");
        if (!res.ok) return;

        const data = await res.json();
        const resyncJobs = (data.jobs ?? []).filter(
          (j: ActiveJob) =>
            j.type === "resync" &&
            (j.status === "pending" || j.status === "running")
        );

        const urls = new Set<string>(
          resyncJobs.flatMap((j: ActiveJob) => j.urls ?? [])
        );
        setSyncingUrls(urls);

        const hasSyncing = urls.size > 0;
        if (!hasSyncing && prevHadSyncing.current) {
          router.refresh();
        }
        prevHadSyncing.current = hasSyncing;
      } catch {
        // Silently ignore polling errors
      }
    }

    poll();
    const timer = setInterval(poll, 3000);
    return () => clearInterval(timer);
  }, [router]);

  return syncingUrls;
}
