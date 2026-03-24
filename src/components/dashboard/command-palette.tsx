"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

const NAV_COMMANDS = [
  { id: "dashboard", label: "Dashboard", href: "/dashboard" },
  { id: "inbox", label: "Inbox", href: "/inbox" },
  { id: "knowledge-base", label: "Knowledge Base", href: "/knowledge-base" },
  { id: "playground", label: "Playground", href: "/playground" },
  { id: "settings", label: "Settings", href: "/settings" },
];

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filtered = NAV_COMMANDS.filter((cmd) =>
    cmd.label.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = useCallback(
    (href: string) => {
      onClose();
      setQuery("");
      setSelectedIndex(0);
      router.push(href);
    },
    [onClose, router]
  );

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (open) {
          onClose();
        } else {
          // Parent controls open state, but we handle the global shortcut here
          // This is handled by the parent's onOpenCommandPalette
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      e.preventDefault();
      handleSelect(filtered[selectedIndex].href);
    } else if (e.key === "Escape") {
      onClose();
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40"
        onClick={onClose}
      />
      {/* Palette */}
      <div className="relative w-full max-w-lg rounded-xl border border-border bg-surface shadow-2xl">
        <div className="border-b border-border p-3">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search or jump to..."
            className="w-full bg-transparent font-body text-sm text-text-primary placeholder:text-text-secondary focus:outline-none"
          />
        </div>
        <div className="max-h-72 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-text-secondary">
              No results found.
            </p>
          ) : (
            <>
              <p className="px-3 py-1.5 font-display text-xs font-semibold uppercase tracking-wider text-text-secondary">
                Navigation
              </p>
              {filtered.map((cmd, i) => (
                <button
                  key={cmd.id}
                  onClick={() => handleSelect(cmd.href)}
                  className={`flex w-full items-center rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    i === selectedIndex
                      ? "bg-success-light text-primary"
                      : "text-text-primary hover:bg-surface-alt"
                  }`}
                >
                  {cmd.label}
                </button>
              ))}
            </>
          )}
        </div>
        <div className="border-t border-border px-3 py-2">
          <div className="flex items-center gap-3 font-mono text-xs text-text-secondary">
            <span>
              <kbd className="rounded border border-border bg-surface-alt px-1">↑↓</kbd> navigate
            </span>
            <span>
              <kbd className="rounded border border-border bg-surface-alt px-1">↵</kbd> select
            </span>
            <span>
              <kbd className="rounded border border-border bg-surface-alt px-1">esc</kbd> close
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
