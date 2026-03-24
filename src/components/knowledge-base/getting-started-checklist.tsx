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
    <div className="mb-8 rounded-lg border border-border bg-surface-alt p-6">
      <h2 className="mb-1 text-lg font-semibold font-display text-text-primary">
        Get started with your knowledge base
      </h2>
      <p className="mb-5 text-sm text-text-secondary">
        Add content so Envoyer can draft accurate replies.
      </p>
      <div className="space-y-3">
        {ITEMS.map((item) => {
          const done = completed[item.key];
          return (
            <Link
              key={item.key}
              href={item.href}
              className="flex items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-surface"
            >
              {done ? (
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success-light">
                  <svg
                    className="h-3 w-3 text-primary"
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
                <div className="mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 border-border" />
              )}
              <div>
                <p
                  className={`text-sm font-medium font-display ${
                    done
                      ? "text-text-secondary line-through"
                      : "text-text-primary"
                  }`}
                >
                  {item.label}
                </p>
                <p className="text-xs text-text-secondary">
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
