"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Checkbox } from "@/components/ui/checkbox";

interface UrlSelectorProps {
  urls: { url: string; suggested: boolean }[];
  onBack: () => void;
}

interface UrlGroup {
  key: string;
  urls: { url: string; path: string; suggested: boolean }[];
}

export function UrlSelector({ urls, onBack }: UrlSelectorProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(urls.filter((u) => u.suggested).map((u) => u.url))
  );
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

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
    const map = new Map<string, { url: string; path: string; suggested: boolean }[]>();

    for (const item of filtered) {
      let path: string;
      try {
        path = new URL(item.url).pathname;
      } catch {
        path = item.url;
      }

      const segments = path.split("/").filter(Boolean);
      const groupKey = segments.length > 0 ? `/${segments[0]}` : "/";

      if (!map.has(groupKey)) map.set(groupKey, []);
      map.get(groupKey)!.push({ url: item.url, path, suggested: item.suggested });
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
  }, [filtered]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((u) => selected.has(u.url));

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
        setError(data.error || "Failed to extract pages");
        return;
      }

      router.push("/knowledge-base");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          &larr; Back
        </button>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          {selected.size} of {urls.length} selected
        </span>
      </div>
      <input
        type="text"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-400 dark:focus:ring-zinc-400"
        placeholder="Filter URLs..."
      />
      <div className="flex items-center gap-2">
        <button
          onClick={toggleAll}
          className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          {allFilteredSelected ? "Deselect all" : "Select all"}
        </button>
      </div>
      <div className="max-h-96 overflow-y-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
        {groups.map((group) => {
          const groupSelectedCount = group.urls.filter((u) => selected.has(u.url)).length;
          const allGroupSelected = groupSelectedCount === group.urls.length;
          const someGroupSelected = groupSelectedCount > 0 && !allGroupSelected;
          const isCollapsed = collapsed.has(group.key);

          return (
            <div key={group.key}>
              <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-zinc-100 bg-zinc-50 px-2 py-2 dark:border-zinc-800 dark:bg-zinc-800/50">
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
                    className={`h-3.5 w-3.5 text-zinc-400 transition-transform ${isCollapsed ? "" : "rotate-90"}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    {group.key}
                  </span>
                  <span className="text-xs text-zinc-400 dark:text-zinc-500">
                    {groupSelectedCount}/{group.urls.length}
                  </span>
                </button>
              </div>
              {!isCollapsed && (
                <div>
                  {group.urls.map(({ url, path, suggested }) => (
                    <div
                      key={url}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-2.5 pl-9 text-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    >
                      <Checkbox
                        checked={selected.has(url)}
                        onCheckedChange={() => toggle(url)}
                      />
                      <span className="min-w-0 flex-1 truncate">
                        <span className="text-zinc-400 dark:text-zinc-500">{domain}</span>
                        <span className="text-zinc-700 dark:text-zinc-300">{path}</span>
                      </span>
                      {suggested && (
                        <span className="ml-auto shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
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
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      <button
        onClick={handleSubmit}
        disabled={loading || selected.size === 0}
        className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {loading
          ? "Extracting content..."
          : `Import ${selected.size} page${selected.size === 1 ? "" : "s"}`}
      </button>
    </div>
  );
}
