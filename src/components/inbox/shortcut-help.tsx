"use client";

import { useIsMac } from "@/lib/hooks/use-keyboard-shortcut";

interface ShortcutHelpProps {
  open: boolean;
  onClose: () => void;
}

type Shortcut = { keys: string[]; label: string };
type Group = { title: string; shortcuts: Shortcut[] };

function buildGroups(mod: string): Group[] {
  return [
    {
      title: "Draft",
      shortcuts: [
        { keys: [mod, "↵"], label: "Send" },
        { keys: [mod, "Shift", "↵"], label: "Send & Close" },
        { keys: [mod, "Shift", "C"], label: "Regenerate (while editing)" },
        { keys: ["c"], label: "Regenerate" },
        { keys: ["e"], label: "Edit draft" },
        { keys: ["Esc"], label: "Stop editing" },
      ],
    },
    {
      title: "Inbox",
      shortcuts: [
        { keys: ["j"], label: "Next ticket" },
        { keys: ["k"], label: "Previous ticket" },
      ],
    },
    {
      title: "General",
      shortcuts: [
        { keys: ["?"], label: "Toggle this help" },
      ],
    },
  ];
}

export function ShortcutHelp({ open, onClose }: ShortcutHelpProps) {
  const isMac = useIsMac();
  const groups = buildGroups(isMac ? "⌘" : "Ctrl");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close shortcuts"
        className="fixed inset-0 bg-black/40"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md rounded-xl border border-border bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="font-display text-sm font-semibold text-text-primary">
            Keyboard shortcuts
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-text-secondary hover:text-text-primary"
            aria-label="Close"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-4 py-3">
          {groups.map((group) => (
            <div key={group.title} className="mb-4 last:mb-0">
              <p className="mb-2 font-display text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
                {group.title}
              </p>
              <ul className="space-y-1.5">
                {group.shortcuts.map((s) => (
                  <li key={s.label} className="flex items-center justify-between text-sm">
                    <span className="font-body text-text-primary">{s.label}</span>
                    <span className="flex items-center gap-1">
                      {s.keys.map((k, i) => (
                        <kbd
                          key={i}
                          className="rounded border border-border bg-surface-alt px-1.5 py-0.5 font-mono text-[11px] text-text-primary"
                        >
                          {k}
                        </kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
