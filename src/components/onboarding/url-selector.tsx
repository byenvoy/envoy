"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Checkbox } from "@/components/ui/checkbox";

interface LocaleInfo {
  locales: string[];
  defaultLocale: string;
}

interface UrlSelectorProps {
  urls: { url: string; suggested: boolean }[];
  localeInfo: LocaleInfo | null;
  onBack: () => void;
  onComplete?: () => void;
}

interface UrlGroup {
  key: string;
  urls: { url: string; path: string; suggested: boolean }[];
}

const URL_CAP = 200;
const LOCALE_PREFIX_REGEX = /^\/([a-z]{2}(?:-[A-Z]{2})?)(\/|$)/;

function stripLocalePrefix(pathname: string): string {
  return pathname.replace(LOCALE_PREFIX_REGEX, "/");
}

function filterUrlsByLocale(
  urls: { url: string; suggested: boolean }[],
  locale: string
): { url: string; suggested: boolean }[] {
  const seen = new Set<string>();
  const result: { url: string; suggested: boolean }[] = [];

  for (const item of urls) {
    try {
      const parsed = new URL(item.url);
      const match = parsed.pathname.match(LOCALE_PREFIX_REGEX);
      const urlLocale = match ? match[1] : null;

      if (urlLocale && urlLocale !== locale) continue;

      const canonical = stripLocalePrefix(parsed.pathname);
      if (seen.has(canonical)) continue;
      seen.add(canonical);
      result.push(item);
    } catch {
      result.push(item);
    }
  }

  return result.slice(0, URL_CAP);
}

export function UrlSelector({
  urls: allUrls,
  localeInfo,
  onBack,
  onComplete,
}: UrlSelectorProps) {
  const router = useRouter();
  const [selectedLocale, setSelectedLocale] = useState(
    localeInfo?.defaultLocale ?? null
  );

  // Apply locale filtering client-side
  const urls = useMemo(() => {
    if (!localeInfo || !selectedLocale) return allUrls.slice(0, URL_CAP);
    return filterUrlsByLocale(allUrls, selectedLocale);
  }, [allUrls, localeInfo, selectedLocale]);

  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(urls.filter((u) => u.suggested).map((u) => u.url))
  );
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  // When locale changes, reset selection to suggested URLs in the new set
  const handleLocaleChange = useCallback(
    (locale: string) => {
      setSelectedLocale(locale);
      const newUrls = filterUrlsByLocale(allUrls, locale);
      setSelected(
        new Set(newUrls.filter((u) => u.suggested).map((u) => u.url))
      );
      setFilter("");
      setCollapsed(new Set());
    },
    [allUrls]
  );

  const domain = useMemo(() => {
    if (urls.length === 0) return "";
    try {
      const u = new URL(urls[0].url);
      return `${u.protocol}//${u.host}`;
    } catch {
      return "";
    }
  }, [urls]);

  const filtered = useMemo(() => {
    if (!filter) return urls;
    const lower = filter.toLowerCase();
    return urls.filter((u) => u.url.toLowerCase().includes(lower));
  }, [urls, filter]);

  const groups = useMemo<UrlGroup[]>(() => {
    const map = new Map<
      string,
      { url: string; path: string; suggested: boolean }[]
    >();

    for (const item of filtered) {
      let path: string;
      try {
        path = new URL(item.url).pathname;
      } catch {
        path = item.url;
      }

      // Strip locale prefix for grouping so /en-AU/help and /help group the same
      const cleanPath = localeInfo ? stripLocalePrefix(path) : path;
      const segments = cleanPath.split("/").filter(Boolean);
      const groupKey = segments.length > 0 ? `/${segments[0]}` : "/";

      if (!map.has(groupKey)) map.set(groupKey, []);
      map.get(groupKey)!.push({
        url: item.url,
        path,
        suggested: item.suggested,
      });
    }

    // Sort URLs within each group: suggested first, then alphabetically
    for (const items of map.values()) {
      items.sort((a, b) => {
        if (a.suggested !== b.suggested) return a.suggested ? -1 : 1;
        return a.path.localeCompare(b.path);
      });
    }

    // Sort groups: more suggested URLs first, then alphabetically
    const entries = Array.from(map.entries()).map(([key, items]) => ({
      key,
      urls: items,
    }));

    entries.sort((a, b) => {
      const aSuggested = a.urls.filter((u) => u.suggested).length;
      const bSuggested = b.urls.filter((u) => u.suggested).length;
      if (aSuggested !== bSuggested) return bSuggested - aSuggested;
      return a.key.localeCompare(b.key);
    });

    return entries;
  }, [filtered, localeInfo]);

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((u) => selected.has(u.url));

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filtered.forEach((u) => next.delete(u.url));
      } else {
        filtered.forEach((u) => next.add(u.url));
      }
      return next;
    });
  }

  function toggle(url: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(url)) {
        next.delete(url);
      } else {
        next.add(url);
      }
      return next;
    });
  }

  const toggleGroup = useCallback(
    (groupKey: string) => {
      const group = groups.find((g) => g.key === groupKey);
      if (!group) return;
      setSelected((prev) => {
        const next = new Set(prev);
        const allSelected = group.urls.every((u) => next.has(u.url));
        if (allSelected) {
          group.urls.forEach((u) => next.delete(u.url));
        } else {
          group.urls.forEach((u) => next.add(u.url));
        }
        return next;
      });
    },
    [groups]
  );

  const toggleCollapse = useCallback((groupKey: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  }, []);

  async function handleSubmit() {
    if (selected.size === 0) return;
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/crawl/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: Array.from(selected) }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to enqueue crawl");
        setLoading(false);
        return;
      }

      // Job enqueued — redirect immediately, progress shown on KB page
      if (onComplete) {
        onComplete();
      } else {
        router.push("/knowledge-base");
        router.refresh();
      }
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="text-sm text-text-secondary transition-colors hover:text-text-primary"
        >
          &larr; Change URL
        </button>
        <span className="text-sm text-text-secondary">
          {selected.size} of {urls.length} selected
        </span>
      </div>
      {localeInfo && localeInfo.locales.length > 1 && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
          <span className="text-xs font-medium text-text-secondary">
            Locale:
          </span>
          <select
            value={selectedLocale ?? localeInfo.defaultLocale}
            onChange={(e) => handleLocaleChange(e.target.value)}
            className="cursor-pointer rounded border border-border bg-surface-alt px-2 py-1 text-xs font-medium text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {localeInfo.locales.map((locale) => (
              <option key={locale} value={locale}>
                {locale}
              </option>
            ))}
          </select>
          <span className="text-xs text-text-secondary">
            {localeInfo.locales.length} locales detected
          </span>
        </div>
      )}
      <div className="relative">
        <svg
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
          />
        </svg>
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 pl-9 text-sm text-text-primary placeholder-text-secondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="Filter URLs..."
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={toggleAll}
          className="text-sm font-medium text-text-secondary hover:text-text-primary"
        >
          {allFilteredSelected ? "Deselect all" : "Select all"}
        </button>
      </div>
      <div className="max-h-96 overflow-y-auto rounded-lg border border-border bg-surface-alt">
        {groups.map((group) => {
          const groupSelectedCount = group.urls.filter((u) =>
            selected.has(u.url)
          ).length;
          const allGroupSelected =
            groupSelectedCount === group.urls.length;
          const someGroupSelected =
            groupSelectedCount > 0 && !allGroupSelected;
          const isCollapsed = collapsed.has(group.key);

          return (
            <div key={group.key}>
              <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-surface px-2 py-2">
                <Checkbox
                  checked={allGroupSelected}
                  indeterminate={someGroupSelected}
                  onCheckedChange={() => toggleGroup(group.key)}
                />
                <button
                  onClick={() => toggleCollapse(group.key)}
                  className="flex flex-1 items-center gap-1.5"
                >
                  <svg
                    className={`h-3.5 w-3.5 text-text-secondary transition-transform ${isCollapsed ? "" : "rotate-90"}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="text-xs font-medium font-display text-text-primary">
                    {group.key}
                  </span>
                  <span className="text-xs text-text-secondary">
                    {groupSelectedCount}/{group.urls.length}
                  </span>
                </button>
              </div>
              {!isCollapsed && (
                <div>
                  {group.urls.map(({ url, path, suggested }) => (
                    <div
                      key={url}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-2.5 pl-9 text-sm transition-colors hover:bg-surface"
                    >
                      <Checkbox
                        checked={selected.has(url)}
                        onCheckedChange={() => toggle(url)}
                      />
                      <span className="min-w-0 flex-1 truncate">
                        <span className="text-text-secondary">{domain}</span>
                        <span className="text-text-primary">{path}</span>
                      </span>
                      {suggested && (
                        <span className="ml-auto shrink-0 rounded-full bg-success-light px-2 py-0.5 text-xs font-medium text-primary">
                          Suggested
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {error && <p className="text-sm text-error">{error}</p>}
      <button
        onClick={handleSubmit}
        disabled={loading || selected.size === 0}
        className="w-full cursor-pointer rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading
          ? "Starting crawl..."
          : `Import ${selected.size} page${selected.size === 1 ? "" : "s"}`}
      </button>
    </div>
  );
}
