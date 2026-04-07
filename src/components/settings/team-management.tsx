"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface TeamMember {
  id: string;
  full_name: string | null;
  role: string;
}

interface Invite {
  id: string;
  email: string;
  role: string;
  token: string;
  accepted_at: string | null;
  expires_at: string;
}

export function TeamManagement({
  members,
  invites: initialInvites,
  currentUserId,
  appUrl,
}: {
  members: TeamMember[];
  invites: Invite[];
  currentUserId: string;
  appUrl: string;
}) {
  const [email, setEmail] = useState("");
  const [invites, setInvites] = useState(initialInvites);
  const [inviting, setInviting] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setInviting(true);
    try {
      const res = await fetch("/api/settings/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role: "agent" }),
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

  async function handleRemove() {
    if (!removeTarget) return;
    setRemoveTarget(null);
    await fetch("/api/settings/team/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile_id: removeTarget }),
    });
    window.location.reload();
  }

  function copyInviteLink(token: string) {
    navigator.clipboard.writeText(`${appUrl}/api/invite/${token}`);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-3 text-sm font-display font-medium text-text-primary">
          Team Members
        </h3>
        <div className="divide-y divide-border rounded-lg border border-border">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-text-primary">
                  {member.full_name || "Unnamed"}
                </p>
                <p className="text-xs text-text-secondary">
                  {member.role}
                </p>
              </div>
              {member.id !== currentUserId && member.role !== "owner" && (
                <button
                  type="button"
                  onClick={() => setRemoveTarget(member.id)}
                  className="text-xs text-error hover:text-error"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-display font-medium text-text-primary">
          Invite Team Member
        </h3>
        <form onSubmit={handleInvite} className="flex flex-col gap-2 sm:flex-row">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="agent@example.com"
            className="flex-1 rounded-lg border border-border bg-surface-alt px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-primary focus:outline-none"
          />
          <button
            type="submit"
            disabled={inviting || !email}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
          >
            {inviting ? "Inviting..." : "Generate Link"}
          </button>
        </form>
      </div>

      {invites.filter((i) => !i.accepted_at).length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-display font-medium text-text-primary">
            Pending Invites
          </h3>
          <div className="space-y-2">
            {invites
              .filter((i) => !i.accepted_at)
              .map((invite) => (
                <div
                  key={invite.id}
                  className="flex items-center justify-between rounded-lg border border-border px-4 py-3"
                >
                  <div>
                    <p className="text-sm text-text-primary">
                      {invite.email}
                    </p>
                    <p className="text-xs text-text-secondary">
                      Expires{" "}
                      {new Date(invite.expires_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyInviteLink(invite.token)}
                    className="text-xs text-text-secondary hover:text-text-primary"
                  >
                    {copiedToken === invite.token ? "Copied!" : "Copy Link"}
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}
      <ConfirmDialog
        open={removeTarget !== null}
        title="Remove team member"
        description="This person will lose access to the organization immediately."
        confirmLabel="Remove"
        variant="danger"
        onConfirm={handleRemove}
        onCancel={() => setRemoveTarget(null)}
      />
    </div>
  );
}
