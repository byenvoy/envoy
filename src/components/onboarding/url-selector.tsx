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

interface UrlEntry {
  url: string;
  path: string;
  suggested: boolean;
}

interface PathGroup {
  key: string;
  urls: UrlEntry[];
}

interface LocaleGroup {
  locale: string;
  label: string;
  pathGroups: PathGroup[];
  allUrls: UrlEntry[];
}

const LOCALE_PREFIX_REGEX = /^\/([a-z]{2}(?:-[A-Z]{2})?)(\/|$)/;

function getLocaleFromPath(pathname: string): string | null {
  const match = pathname.match(LOCALE_PREFIX_REGEX);
  return match ? match[1] : null;
}

function stripLocalePrefix(pathname: string): string {
  return pathname.replace(LOCALE_PREFIX_REGEX, "/");
}

export function UrlSelector({
  urls: allUrls,
  localeInfo,
  onBack,
  onComplete,
}: UrlSelectorProps) {
  const router = useRouter();

  const [selected, setSelected] = useState<Set<string>>(() => {
    if (!localeInfo) {
      return new Set(allUrls.filter((u) => u.suggested).map((u) => u.url));
    }
    // Only pre-select suggested URLs from the default locale
    const defaultLocale = localeInfo.defaultLocale;
    return new Set(
      allUrls
        .filter((u) => {
          if (!u.suggested) return false;
          try {
            const locale = getLocaleFromPath(new URL(u.url).pathname);
            return locale === defaultLocale || locale === null;
          } catch {
            return false;
          }
        })
        .map((u) => u.url)
    );
  });
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsedLocales, setCollapsedLocales] = useState<Set<string>>(() => {
    if (!localeInfo) return new Set();
    // Collapse all non-default locales
    return new Set(
      localeInfo.locales.filter((l) => l !== localeInfo.defaultLocale)
    );
  });
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(
    () => new Set()
  );

  const domain = useMemo(() => {
    if (allUrls.length === 0) return "";
    try {
      const u = new URL(allUrls[0].url);
      return `${u.protocol}//${u.host}`;
    } catch {
      return "";
    }
  }, [allUrls]);

  const filtered = useMemo(() => {
    if (!filter) return allUrls;
    const lower = filter.toLowerCase();
    return allUrls.filter((u) => u.url.toLowerCase().includes(lower));
  }, [allUrls, filter]);

  // Build locale groups (or flat path groups when no locales)
  const localeGroups = useMemo<LocaleGroup[]>(() => {
    if (!localeInfo) {
      // No locales — single group with path-based sub-groups
      const pathGroups = buildPathGroups(filtered, null);
      return [
        {
          locale: "",
          label: "",
          pathGroups,
          allUrls: pathGroups.flatMap((g) => g.urls),
        },
      ];
    }

    // Group URLs by locale
    const localeMap = new Map<string, { url: string; suggested: boolean }[]>();
    const generalUrls: { url: string; suggested: boolean }[] = [];

    for (const item of filtered) {
      try {
        const pathname = new URL(item.url).pathname;
        const locale = getLocaleFromPath(pathname);
        if (locale) {
          if (!localeMap.has(locale)) localeMap.set(locale, []);
          localeMap.get(locale)!.push(item);
        } else {
          generalUrls.push(item);
        }
      } catch {
        generalUrls.push(item);
      }
    }

    const groups: LocaleGroup[] = [];

    // Add locale groups in the order from localeInfo (most URLs first)
    for (const locale of localeInfo.locales) {
      const items = localeMap.get(locale) || [];
      if (items.length === 0) continue;
      const pathGroups = buildPathGroups(items, locale);
      groups.push({
        locale,
        label: locale,
        pathGroups,
        allUrls: pathGroups.flatMap((g) => g.urls),
      });
    }

    // Add general (non-prefixed) group if any
    if (generalUrls.length > 0) {
      const pathGroups = buildPathGroups(generalUrls, null);
      groups.push({
        locale: "_general",
        label: "General",
        pathGroups,
        allUrls: pathGroups.flatMap((g) => g.urls),
      });
    }

    return groups;
  }, [filtered, localeInfo]);

  const totalUrls = localeGroups.reduce(
    (sum, g) => sum + g.allUrls.length,
    0
  );

  function toggleAll() {
    const allVisible = localeGroups.flatMap((g) => g.allUrls);
    const allSelected = allVisible.every((u) => selected.has(u.url));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        allVisible.forEach((u) => next.delete(u.url));
      } else {
        allVisible.forEach((u) => next.add(u.url));
      }
      return next;
    });
  }

  function toggle(url: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  }

  const toggleLocaleGroup = useCallback(
    (localeKey: string) => {
      const group = localeGroups.find((g) => g.locale === localeKey);
      if (!group) return;
      setSelected((prev) => {
        const next = new Set(prev);
        const allSelected = group.allUrls.every((u) => next.has(u.url));
        if (allSelected) {
          group.allUrls.forEach((u) => next.delete(u.url));
        } else {
          group.allUrls.forEach((u) => next.add(u.url));
        }
        return next;
      });
    },
    [localeGroups]
  );

  const togglePathGroup = useCallback(
    (localeKey: string, pathKey: string) => {
      const localeGroup = localeGroups.find((g) => g.locale === localeKey);
      if (!localeGroup) return;
      const pathGroup = localeGroup.pathGroups.find((g) => g.key === pathKey);
      if (!pathGroup) return;
      setSelected((prev) => {
        const next = new Set(prev);
        const allSelected = pathGroup.urls.every((u) => next.has(u.url));
        if (allSelected) {
          pathGroup.urls.forEach((u) => next.delete(u.url));
        } else {
          pathGroup.urls.forEach((u) => next.add(u.url));
        }
        return next;
      });
    },
    [localeGroups]
  );

  const toggleLocaleCollapse = useCallback((locale: string) => {
    setCollapsedLocales((prev) => {
      const next = new Set(prev);
      if (next.has(locale)) next.delete(locale);
      else next.add(locale);
      return next;
    });
  }, []);

  const togglePathCollapse = useCallback((compositeKey: string) => {
    setCollapsedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(compositeKey)) next.delete(compositeKey);
      else next.add(compositeKey);
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

  const hasLocales = localeInfo && localeInfo.locales.length > 1;
  const allVisible = localeGroups.flatMap((g) => g.allUrls);
  const allVisibleSelected =
    allVisible.length > 0 && allVisible.every((u) => selected.has(u.url));

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
          {selected.size} of {totalUrls} selected
        </span>
      </div>
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
          {allVisibleSelected ? "Deselect all" : "Select all"}
        </button>
      </div>
      <div className="max-h-[32rem] overflow-y-auto rounded-lg border border-border bg-surface-alt">
        {localeGroups.map((localeGroup) => {
          const localeSelectedCount = localeGroup.allUrls.filter((u) =>
            selected.has(u.url)
          ).length;
          const isLocaleCollapsed = collapsedLocales.has(localeGroup.locale);

          return (
            <div key={localeGroup.locale}>
              {/* Locale header — only show when there are multiple locales */}
              {hasLocales && (
                <div className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-surface-alt px-2 py-2">
                  <Checkbox
                    checked={
                      localeSelectedCount === localeGroup.allUrls.length
                    }
                    indeterminate={
                      localeSelectedCount > 0 &&
                      localeSelectedCount < localeGroup.allUrls.length
                    }
                    onCheckedChange={() =>
                      toggleLocaleGroup(localeGroup.locale)
                    }
                  />
                  <button
                    onClick={() => toggleLocaleCollapse(localeGroup.locale)}
                    className="flex flex-1 items-center gap-1.5"
                  >
                    <svg
                      className={`h-3.5 w-3.5 text-text-secondary transition-transform ${isLocaleCollapsed ? "" : "rotate-90"}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path d="M9 5l7 7-7 7" />
                    </svg>
                    <span className="text-sm font-medium font-display text-text-primary">
                      {localeGroup.label}
                    </span>
                    <span className="text-xs text-text-secondary">
                      {localeSelectedCount}/{localeGroup.allUrls.length}
                    </span>
                  </button>
                </div>
              )}
              {!isLocaleCollapsed &&
                localeGroup.pathGroups.map((pathGroup) => {
                  const pathSelectedCount = pathGroup.urls.filter((u) =>
                    selected.has(u.url)
                  ).length;
                  const allPathSelected =
                    pathSelectedCount === pathGroup.urls.length;
                  const somePathSelected =
                    pathSelectedCount > 0 && !allPathSelected;
                  const compositeKey = `${localeGroup.locale}:${pathGroup.key}`;
                  const isPathCollapsed = collapsedPaths.has(compositeKey);

                  return (
                    <div key={compositeKey}>
                      <div
                        className={`sticky ${hasLocales ? "top-[37px]" : "top-0"} z-10 flex items-center gap-2 border-b border-border bg-surface px-2 py-2 ${hasLocales ? "pl-4" : ""}`}
                      >
                        <Checkbox
                          checked={allPathSelected}
                          indeterminate={somePathSelected}
                          onCheckedChange={() =>
                            togglePathGroup(
                              localeGroup.locale,
                              pathGroup.key
                            )
                          }
                        />
                        <button
                          onClick={() => togglePathCollapse(compositeKey)}
                          className="flex flex-1 items-center gap-1.5"
                        >
                          <svg
                            className={`h-3.5 w-3.5 text-text-secondary transition-transform ${isPathCollapsed ? "" : "rotate-90"}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path d="M9 5l7 7-7 7" />
                          </svg>
                          <span className="text-xs font-medium font-display text-text-primary">
                            {pathGroup.key}
                          </span>
                          <span className="text-xs text-text-secondary">
                            {pathSelectedCount}/{pathGroup.urls.length}
                          </span>
                        </button>
                      </div>
                      {!isPathCollapsed && (
                        <div>
                          {pathGroup.urls.map(({ url, path, suggested }) => (
                            <div
                              key={url}
                              className={`flex cursor-pointer items-center gap-2 rounded px-2 py-2.5 text-sm transition-colors hover:bg-surface ${hasLocales ? "pl-12" : "pl-9"}`}
                              onClick={() => toggle(url)}
                            >
                              <Checkbox
                                checked={selected.has(url)}
                                onCheckedChange={() => toggle(url)}
                              />
                              <span className="min-w-0 flex-1 truncate">
                                <span className="text-text-secondary">
                                  {domain}
                                </span>
                                <span className="text-text-primary">
                                  {path}
                                </span>
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

function buildPathGroups(
  items: { url: string; suggested: boolean }[],
  locale: string | null
): PathGroup[] {
  const map = new Map<string, UrlEntry[]>();

  for (const item of items) {
    let path: string;
    try {
      path = new URL(item.url).pathname;
    } catch {
      path = item.url;
    }

    const cleanPath = locale ? stripLocalePrefix(path) : path;
    const segments = cleanPath.split("/").filter(Boolean);
    const groupKey = segments.length > 0 ? `/${segments[0]}` : "/";

    if (!map.has(groupKey)) map.set(groupKey, []);
    map.get(groupKey)!.push({
      url: item.url,
      path,
      suggested: item.suggested,
    });
  }

  for (const urls of map.values()) {
    urls.sort((a, b) => {
      if (a.suggested !== b.suggested) return a.suggested ? -1 : 1;
      return a.path.localeCompare(b.path);
    });
  }

  const entries = Array.from(map.entries()).map(([key, urls]) => ({
    key,
    urls,
  }));

  entries.sort((a, b) => {
    const aSuggested = a.urls.filter((u) => u.suggested).length;
    const bSuggested = b.urls.filter((u) => u.suggested).length;
    if (aSuggested !== bSuggested) return bSuggested - aSuggested;
    return a.key.localeCompare(b.key);
  });

  return entries;
}
