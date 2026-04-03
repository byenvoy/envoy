"use client";

import { useState } from "react";
import type { AutopilotTopic, AutopilotMode } from "@/lib/types/database";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const MODE_LABELS: Record<AutopilotMode, { label: string; color: string }> = {
  off: { label: "Off", color: "bg-surface text-text-secondary" },
  shadow: { label: "Calibrating", color: "bg-ai-light text-ai-accent" },
  auto: { label: "Active", color: "bg-success-light text-primary" },
};

const MODES: AutopilotMode[] = ["off", "shadow", "auto"];

const TOPIC_TEMPLATES = [
  {
    name: "Shipping & Order Tracking",
    description: "Customer inquiries about order status, shipping updates, delivery timelines, tracking numbers, and estimated delivery dates.",
  },
  {
    name: "Returns & Refunds",
    description: "Requests to return an item, questions about return eligibility, refund status, return shipping instructions, and refund processing times.",
  },
  {
    name: "Product Information",
    description: "Questions about product details, sizing, materials, availability, compatibility, and general product recommendations.",
  },
  {
    name: "Order Changes",
    description: "Requests to change, cancel, or modify an existing order — including address changes, item swaps, and cancellation requests before shipment.",
  },
  // {
  //   name: "Account & Password",
  //   description: "Questions about account access, password resets, updating account details, and login issues.",
  // },
];

interface TopicListProps {
  initialTopics: AutopilotTopic[];
  isCloud: boolean;
}

export function TopicList({ initialTopics, isCloud }: TopicListProps) {
  const [topics, setTopics] = useState<AutopilotTopic[]>(initialTopics);
  const [showForm, setShowForm] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [threshold, setThreshold] = useState(0.95);
  const [dailyLimit, setDailyLimit] = useState(100);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [deleteTopicId, setDeleteTopicId] = useState<string | null>(null);

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
                <button
                  role="switch"
                  aria-checked={topic.mode !== "off"}
                  onClick={() => handleModeChange(topic.id, topic.mode === "off" ? (isCloud ? "shadow" : "auto") : "off")}
                  className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                    topic.mode !== "off" ? "bg-primary" : "bg-border"
                  }`}
                >
                  <span className={`absolute inset-y-0 left-0 w-[34px] flex items-center justify-center text-[10px] font-semibold text-white transition-opacity ${
                    topic.mode !== "off" ? "opacity-100" : "opacity-0"
                  }`}>
                    On
                  </span>
                  <span className={`absolute inset-y-0 right-0 w-[34px] flex items-center justify-center text-[10px] font-semibold text-text-secondary transition-opacity ${
                    topic.mode !== "off" ? "opacity-0" : "opacity-100"
                  }`}>
                    Off
                  </span>
                  <span
                    className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                      topic.mode !== "off" ? "translate-x-8" : "translate-x-0.5"
                    }`}
                  />
                </button>
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
                  onClick={() => setDeleteTopicId(topic.id)}
                  className="text-error hover:text-error/80"
                >
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      ))}

      {/* Create/edit form */}
      {showForm && (
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
              placeholder="Describe the types of emails this topic covers. Be specific — this is used to classify incoming emails."
              rows={3}
              className="w-full rounded-lg border border-border bg-surface-alt px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-primary focus:outline-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={saving || !name.trim() || !description.trim()}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
            >
              {saving ? "Adding..." : "Add Topic"}
            </button>
            <button
              onClick={() => { setShowForm(false); setName(""); setDescription(""); }}
              className="rounded-lg px-4 py-2 text-sm text-text-secondary hover:text-text-primary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Prebuilt templates — always visible, filtered to hide already-added ones */}
      {!showForm && (() => {
        const available = TOPIC_TEMPLATES.filter(
          (t) => !topics.some((existing) => existing.name === t.name)
        );
        if (available.length === 0) return null;
        return (
          <div className="space-y-2">
            {topics.length > 0 && (
              <p className="text-xs font-display font-medium text-text-secondary pt-1">
                Templates
              </p>
            )}
            {available.map((template) => (
              <button
                key={template.name}
                onClick={() => {
                  setName(template.name);
                  setDescription(template.description);
                  setShowForm(true);
                }}
                className="w-full rounded-lg border border-dashed border-border bg-surface p-3 text-left transition-colors hover:border-primary"
              >
                <p className="font-display text-sm font-medium text-text-primary">
                  {template.name}
                </p>
                <p className="mt-0.5 text-xs text-text-secondary line-clamp-2">
                  {template.description}
                </p>
              </button>
            ))}
          </div>
        );
      })()}

      {/* Custom topic button */}
      {!showForm && (
        <button
          onClick={() => { setName(""); setDescription(""); setShowForm(true); }}
          className="w-full rounded-lg border border-dashed border-border py-3 text-sm font-medium text-text-secondary transition-colors hover:border-primary hover:text-primary"
        >
          + Create custom topic
        </button>
      )}

      <ConfirmDialog
        open={deleteTopicId !== null}
        title="Delete topic"
        description="Are you sure you want to delete this topic? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => {
          if (deleteTopicId) handleDelete(deleteTopicId);
          setDeleteTopicId(null);
        }}
        onCancel={() => setDeleteTopicId(null)}
      />
    </div>
  );
}
