"use client";

import { useState } from "react";
import type { AutopilotTopic, AutopilotMode } from "@/lib/types/database";

const MODE_LABELS: Record<AutopilotMode, { label: string; color: string }> = {
  off: { label: "Off", color: "bg-surface text-text-secondary" },
  shadow: { label: "Calibrating", color: "bg-ai-light text-ai-accent" },
  auto: { label: "Active", color: "bg-success-light text-primary" },
};

const MODES: AutopilotMode[] = ["off", "shadow", "auto"];

interface TopicListProps {
  initialTopics: AutopilotTopic[];
}

export function TopicList({ initialTopics }: TopicListProps) {
  const [topics, setTopics] = useState<AutopilotTopic[]>(initialTopics);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [threshold, setThreshold] = useState(0.95);
  const [dailyLimit, setDailyLimit] = useState(100);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  async function handleCreate() {
    if (!name.trim() || !description.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/autopilot/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          confidence_threshold: threshold,
          daily_send_limit: dailyLimit,
        }),
      });
      const data = await res.json();
      if (data.topic) {
        setTopics([...topics, data.topic]);
        setName("");
        setDescription("");
        setThreshold(0.95);
        setDailyLimit(100);
        setShowForm(false);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleModeChange(topicId: string, mode: AutopilotMode) {
    await fetch(`/api/autopilot/topics/${topicId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    });
    setTopics(topics.map((t) => (t.id === topicId ? { ...t, mode } : t)));
  }

  async function handleDelete(topicId: string) {
    await fetch(`/api/autopilot/topics/${topicId}`, { method: "DELETE" });
    setTopics(topics.filter((t) => t.id !== topicId));
  }

  async function handleEditSave(topicId: string) {
    if (!editName.trim() || !editDescription.trim()) return;
    await fetch(`/api/autopilot/topics/${topicId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName.trim(), description: editDescription.trim() }),
    });
    setTopics(
      topics.map((t) =>
        t.id === topicId ? { ...t, name: editName.trim(), description: editDescription.trim() } : t
      )
    );
    setEditingId(null);
  }

  return (
    <div className="space-y-3">
      {topics.length === 0 && !showForm && (
        <p className="text-sm text-text-secondary">
          No topics configured yet. Add a topic to start using autopilot.
        </p>
      )}

      {topics.map((topic) => (
        <div
          key={topic.id}
          className="rounded-lg border border-border bg-surface p-4"
        >
          {editingId === topic.id ? (
            <div className="space-y-3">
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface-alt px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none"
              />
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-border bg-surface-alt px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => handleEditSave(topic.id)}
                  className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-dark"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="rounded-lg px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-sm font-semibold text-text-primary">
                    {topic.name}
                  </h3>
                  <p className="mt-0.5 text-xs text-text-secondary line-clamp-2">
                    {topic.description}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleModeChange(topic.id, "off")}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                      topic.mode === "off"
                        ? MODE_LABELS.off.color
                        : "text-text-secondary hover:bg-surface-alt"
                    }`}
                  >
                    Off
                  </button>
                  <button
                    onClick={() => handleModeChange(topic.id, topic.mode === "off" ? "shadow" : "off")}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                      topic.mode !== "off"
                        ? "bg-primary text-white"
                        : "text-text-secondary hover:bg-surface-alt"
                    }`}
                  >
                    On
                  </button>
                </div>
              </div>

              {/* Calibrating status */}
              {topic.mode === "shadow" && (
                <div className="mt-3 rounded-md bg-ai-light/40 px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-display font-semibold text-ai-accent">
                      Calibrating
                    </p>
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ai-accent opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-ai-accent" />
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-text-secondary">
                    Getting ready for auto-replies. Drafts require your review
                    before sending while calibration completes. We&#39;ll notify you when ready to go live.
                  </p>
                </div>
              )}

              {/* Active status */}
              {topic.mode === "auto" && (
                <div className="mt-3 rounded-md bg-success-light/50 px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-2 w-2 rounded-full bg-primary" />
                    <p className="text-xs font-display font-medium text-primary">
                      Active
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-text-secondary">
                    Emails matching this topic are being automatically responded to.
                    {topic.daily_sends_today > 0 && (
                      <> {topic.daily_sends_today} sent today.</>
                    )}
                  </p>
                </div>
              )}

              <div className="mt-2 flex items-center justify-end gap-2 text-xs">
                <button
                  onClick={() => {
                    setEditingId(topic.id);
                    setEditName(topic.name);
                    setEditDescription(topic.description);
                  }}
                  className="text-text-secondary hover:text-text-primary"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(topic.id)}
                  className="text-error hover:text-error/80"
                >
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      ))}

      {showForm ? (
        <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
          <div>
            <label className="mb-1 block text-sm font-display font-medium text-text-primary">
              Topic Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Shipping status inquiries"
              className="w-full rounded-lg border border-border bg-surface-alt px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-primary focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-display font-medium text-text-primary">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the types of emails this topic covers. Be specific — this is what the AI uses to classify incoming emails."
              rows={3}
              className="w-full rounded-lg border border-border bg-surface-alt px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-primary focus:outline-none"
            />
          </div>
          <div className="flex gap-4">
            <div>
              <label className="mb-1 block text-xs font-display font-medium text-text-secondary">
                Confidence Threshold
              </label>
              <input
                type="number"
                min={0.5}
                max={1}
                step={0.05}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="w-24 rounded-lg border border-border bg-surface-alt px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-display font-medium text-text-secondary">
                Daily Send Limit
              </label>
              <input
                type="number"
                min={1}
                value={dailyLimit}
                onChange={(e) => setDailyLimit(Number(e.target.value))}
                className="w-24 rounded-lg border border-border bg-surface-alt px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={saving || !name.trim() || !description.trim()}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
            >
              {saving ? "Creating..." : "Create Topic"}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="rounded-lg px-4 py-2 text-sm text-text-secondary hover:text-text-primary"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="w-full rounded-lg border border-dashed border-border py-3 text-sm font-medium text-text-secondary transition-colors hover:border-primary hover:text-primary"
        >
          + Add Topic
        </button>
      )}
    </div>
  );
}
