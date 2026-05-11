"use client";

import { useState } from "react";
import type { TeamInvite } from "@/lib/types/database";

export function TeamStep({
  invites: initialInvites,
  onNext,
  onBack,
  onSkip,
}: {
  invites: TeamInvite[];
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}) {
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"agent" | "owner">("agent");
  const [invites, setInvites] = useState(initialInvites);
  const [inviting, setInviting] = useState(false);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setInviting(true);
    try {
      const res = await fetch("/api/settings/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role: inviteRole }),
      });
      const data = await res.json();
      if (data.invite) {
        setInvites((prev) => [...prev, data.invite]);
      }
      setEmail("");
    } finally {
      setInviting(false);
    }
  }

  const pending = invites.filter((i) => !i.accepted_at);
  const hasInvites = pending.length > 0;

  return (
    <div className="text-center">
      <h2 className="mb-2 font-display text-2xl font-bold tracking-tight text-text-primary">
        Invite your team
      </h2>
      <p className="mb-8 text-sm text-text-secondary">
        Add teammates so they can review and send drafts alongside you. You can always invite more later from Settings. This step is optional.
      </p>

      <div className="space-y-6 text-left">
        <form onSubmit={handleInvite} className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@example.com"
              className="flex-1 rounded-lg border border-border bg-surface-alt px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-primary focus:outline-none"
            />
            <button
              type="submit"
              disabled={inviting || !email}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
            >
              {inviting ? "Sending..." : "Send Invite"}
            </button>
          </div>
          <div className="flex gap-3">
            <label
              className={`flex flex-1 cursor-pointer items-start gap-3 rounded-lg border p-3 transition-all duration-150 ${
                inviteRole === "agent"
                  ? "border-primary bg-success-light"
                  : "border-border hover:border-text-secondary"
              }`}
            >
              <input
                type="radio"
                name="invite-role"
                value="agent"
                checked={inviteRole === "agent"}
                onChange={() => setInviteRole("agent")}
                className="sr-only"
              />
              <span
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-150 ${
                  inviteRole === "agent"
                    ? "border-primary"
                    : "border-border"
                }`}
              >
                {inviteRole === "agent" && (
                  <span className="h-2 w-2 rounded-full bg-primary" />
                )}
              </span>
              <div>
                <p className="text-sm font-display font-medium text-text-primary">Agent</p>
                <p className="mt-0.5 text-xs text-text-secondary">
                  Can use the inbox, manage the knowledge base, and configure autopilot topics.
                </p>
              </div>
            </label>
            <label
              className={`flex flex-1 cursor-pointer items-start gap-3 rounded-lg border p-3 transition-all duration-150 ${
                inviteRole === "owner"
                  ? "border-primary bg-success-light"
                  : "border-border hover:border-text-secondary"
              }`}
            >
              <input
                type="radio"
                name="invite-role"
                value="owner"
                checked={inviteRole === "owner"}
                onChange={() => setInviteRole("owner")}
                className="sr-only"
              />
              <span
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-150 ${
                  inviteRole === "owner"
                    ? "border-primary"
                    : "border-border"
                }`}
              >
                {inviteRole === "owner" && (
                  <span className="h-2 w-2 rounded-full bg-primary" />
                )}
              </span>
              <div>
                <p className="text-sm font-display font-medium text-text-primary">Owner</p>
                <p className="mt-0.5 text-xs text-text-secondary">
                  Full access including billing, API keys, AI model, response style, and team management.
                </p>
              </div>
            </label>
          </div>
        </form>

        {hasInvites && (
          <div>
            <h3 className="mb-3 text-sm font-display font-medium text-text-primary">
              Invites Sent
            </h3>
            <div className="space-y-2">
              {pending.map((invite) => (
                <div
                  key={invite.id}
                  className="rounded-lg border border-border px-4 py-3"
                >
                  <p className="text-sm text-text-primary">{invite.email}</p>
                  <p className="text-xs text-text-secondary">
                    {invite.role === "owner" ? "Owner" : "Agent"} · Invite Expires{" "}
                    {new Date(invite.expires_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-10 flex items-center justify-center gap-4">
        <button
          onClick={onBack}
          className="text-sm text-text-secondary transition-colors hover:text-text-primary"
        >
          &larr; Back
        </button>
        <button
          onClick={hasInvites ? onNext : onSkip}
          className="rounded-lg bg-primary px-8 py-2.5 font-display text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
        >
          Finish
        </button>
      </div>
    </div>
  );
}
