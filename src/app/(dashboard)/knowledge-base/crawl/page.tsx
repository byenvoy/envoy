"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DomainForm } from "@/components/onboarding/domain-form";
import { UrlSelector } from "@/components/onboarding/url-selector";

export default function CrawlPage() {
  const router = useRouter();
  const [urls, setUrls] = useState<
    { url: string; suggested: boolean }[] | null
  >(null);

  function handleComplete() {
    fetch("/api/embeddings/generate", { method: "POST" });
    router.push("/knowledge-base");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6">
        <Link
          href="/knowledge-base"
          className="text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          &larr; Back to Knowledge Base
        </Link>
      </div>
      <h1 className="mb-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        {urls ? "Select pages to import" : "Crawl your website"}
      </h1>
      <p className="mb-8 text-sm text-zinc-500 dark:text-zinc-400">
        {urls
          ? "Choose which pages to add to your knowledge base. Support-related pages are pre-selected."
          : "Enter your website URL and we'll discover pages to build your knowledge base from."}
      </p>
      {urls ? (
        <UrlSelector
          urls={urls}
          onBack={() => setUrls(null)}
          onComplete={handleComplete}
        />
      ) : (
        <DomainForm onUrlsDiscovered={setUrls} />
      )}
    </div>
  );
}
