import Link from "next/link";

const ITEMS = [
  {
    key: "crawled",
    label: "Crawl your website",
    description: "Import pages from your domain automatically",
    href: "/knowledge-base/crawl",
  },
  {
    key: "url",
    label: "Add individual URLs",
    description: "Help docs, blog posts, and other web pages",
    href: "/knowledge-base/new-url",
  },
  {
    key: "upload",
    label: "Upload files",
    description: "PDFs, Word documents, and other files",
    href: "/knowledge-base/upload",
  },
  {
    key: "manual",
    label: "Add manual entries",
    description: "Paste in custom content directly",
    href: "/knowledge-base/new",
  },
];

export function GettingStartedChecklist({
  hasCrawled,
  hasUrl,
  hasUpload,
  hasManual,
}: {
  hasCrawled: boolean;
  hasUrl: boolean;
  hasUpload: boolean;
  hasManual: boolean;
}) {
  const completed: Record<string, boolean> = {
    crawled: hasCrawled,
    url: hasUrl,
    upload: hasUpload,
    manual: hasManual,
  };

  const allDone = ITEMS.every((item) => completed[item.key]);
  if (allDone) return null;

  return (
    <div className="mb-8 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        Get started with your knowledge base
      </h2>
      <p className="mb-5 text-sm text-zinc-500 dark:text-zinc-400">
        Add content so Envoyer can draft accurate replies.
      </p>
      <div className="space-y-3">
        {ITEMS.map((item) => {
          const done = completed[item.key];
          return (
            <Link
              key={item.key}
              href={item.href}
              className="flex items-start gap-3 rounded-lg border border-zinc-100 p-3 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
            >
              {done ? (
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                  <svg
                    className="h-3 w-3 text-emerald-600 dark:text-emerald-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4.5 12.75l6 6 9-13.5"
                    />
                  </svg>
                </div>
              ) : (
                <div className="mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 border-zinc-300 dark:border-zinc-600" />
              )}
              <div>
                <p
                  className={`text-sm font-medium ${
                    done
                      ? "text-zinc-400 line-through dark:text-zinc-500"
                      : "text-zinc-900 dark:text-zinc-50"
                  }`}
                >
                  {item.label}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {item.description}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
