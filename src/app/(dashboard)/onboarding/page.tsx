"use client";

import { useState } from "react";
import { DomainForm } from "@/components/onboarding/domain-form";
import { UrlSelector } from "@/components/onboarding/url-selector";

export default function OnboardingPage() {
  const [urls, setUrls] = useState<
    { url: string; suggested: boolean }[] | null
  >(null);

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        {urls ? "Select pages to import" : "Set up your knowledge base"}
      </h1>
      <p className="mb-8 text-sm text-zinc-500 dark:text-zinc-400">
        {urls
          ? "Choose which pages to add to your knowledge base. Support-related pages are pre-selected."
          : "Enter your website URL and we'll discover pages to build your knowledge base from."}
      </p>
      {urls ? (
        <UrlSelector urls={urls} onBack={() => setUrls(null)} />
      ) : (
        <DomainForm onUrlsDiscovered={setUrls} />
      )}
    </div>
  );
}
