"use client";

import { useState } from "react";

const TONES = [
  {
    value: "professional",
    label: "Professional",
    description:
      "Clear and precise language. Courteous but not overly familiar. No slang or contractions.",
  },
  {
    value: "casual",
    label: "Casual",
    description:
      "Conversational and approachable. Uses contractions, short sentences — like a helpful colleague.",
  },
  {
    value: "technical",
    label: "Technical",
    description:
      "Detail-oriented with precise terminology. Assumes the reader is comfortable with technical language.",
  },
  {
    value: "friendly",
    label: "Friendly",
    description:
      "Warm and empathetic. Personable and caring, uses the customer's name when available.",
  },
] as const;

export function ToneSettings({
  currentTone,
  currentInstructions,
}: {
  currentTone: string;
  currentInstructions: string | null;
}) {
  const [tone, setTone] = useState(currentTone);
  const [instructions, setInstructions] = useState(currentInstructions ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      await fetch("/api/settings/tone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tone,
          custom_instructions: instructions || null,
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-2 block text-sm font-medium text-zinc-900 dark:text-zinc-50">
          Response Tone
        </label>
        <div className="flex flex-wrap gap-2">
          {TONES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTone(t.value)}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                tone === t.value
                  ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {TONES.find((t) => t.value === tone) && (
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            {TONES.find((t) => t.value === tone)!.description}
          </p>
        )}
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-zinc-900 dark:text-zinc-50">
          Custom Instructions
        </label>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          // placeholder="Add any specific instructions for how the AI should respond..."
          placeholder="Add any specific instructions such as prefered sign off method, etc."
          rows={3}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:placeholder:text-zinc-500"
        />
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {saving ? "Saving..." : saved ? "Saved" : "Save"}
      </button>
    </div>
  );
}
