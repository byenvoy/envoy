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
    router.push("/knowledge-base");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6">
        <Link
          href="/knowledge-base"
          className="text-sm text-text-secondary transition-colors hover:text-text-primary"
        >
          &larr; Back to Knowledge Base
        </Link>
      </div>
      <h1 className="mb-2 text-2xl font-bold font-display tracking-tight text-text-primary">
        {urls ? "Select pages to import" : "Crawl your website"}
      </h1>
      <p className="mb-8 text-[15px] text-text-secondary">
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
