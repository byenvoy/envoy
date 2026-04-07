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
  currentGreeting,
  currentSignOff,
}: {
  currentTone: string;
  currentInstructions: string | null;
  currentGreeting: string | null;
  currentSignOff: string | null;
}) {
  const [tone, setTone] = useState(currentTone);
  const [instructions, setInstructions] = useState(currentInstructions ?? "");
  const [greeting, setGreeting] = useState(currentGreeting ?? "");
  const [signOff, setSignOff] = useState(currentSignOff ?? "");
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
          greeting_template: greeting || null,
          sign_off: signOff || null,
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
        <label className="mb-2 block text-sm font-display font-medium text-text-primary">
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
                  ? "bg-primary text-white"
                  : "bg-surface text-text-secondary hover:bg-surface-alt"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {TONES.find((t) => t.value === tone) && (
          <p className="mt-2 text-xs text-text-secondary">
            {TONES.find((t) => t.value === tone)!.description}
          </p>
        )}
      </div>

      <div>
        <label className="mb-2 block text-sm font-display font-medium text-text-primary">
          Greeting
        </label>
        <input
          type="text"
          value={greeting}
          onChange={(e) => setGreeting(e.target.value)}
          placeholder="Hi {name},"
          className="w-full rounded-lg border border-border bg-surface-alt px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-primary focus:outline-none"
        />
        <p className="mt-1 text-xs text-text-secondary">
          Use {"{name}"} to include the customer&apos;s name. Leave blank for no greeting.
        </p>
      </div>

      <div>
        <label className="mb-2 block text-sm font-display font-medium text-text-primary">
          Sign-off
        </label>
        <textarea
          value={signOff}
          onChange={(e) => setSignOff(e.target.value)}
          placeholder={"Best,\nThe Acme Team"}
          rows={2}
          className="w-full rounded-lg border border-border bg-surface-alt px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-primary focus:outline-none"
        />
        <p className="mt-1 text-xs text-text-secondary">
          Appended to the end of every draft. Leave blank for no sign-off.
        </p>
      </div>

      <div>
        <label className="mb-2 block text-sm font-display font-medium text-text-primary">
          Custom Instructions
        </label>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="Add any specific instructions..."
          rows={3}
          className="w-full rounded-lg border border-border bg-surface-alt px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-primary focus:outline-none"
        />
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
      >
        {saving ? "Saving..." : saved ? "Saved" : "Save"}
      </button>
    </div>
  );
}
