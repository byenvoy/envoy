"use client";

import { useState } from "react";

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

  async function handleRemove(profileId: string) {
    if (!confirm("Remove this team member?")) return;
    await fetch("/api/settings/team/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile_id: profileId }),
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
        <h3 className="mb-3 text-sm font-medium text-zinc-900 dark:text-zinc-50">
          Team Members
        </h3>
        <div className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-700 dark:border-zinc-700">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                  {member.full_name || "Unnamed"}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {member.role}
                </p>
              </div>
              {member.id !== currentUserId && member.role !== "owner" && (
                <button
                  type="button"
                  onClick={() => handleRemove(member.id)}
                  className="text-xs text-red-600 hover:text-red-700 dark:text-red-400"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-medium text-zinc-900 dark:text-zinc-50">
          Invite Agent
        </h3>
        <form onSubmit={handleInvite} className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="agent@example.com"
            className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
          />
          <button
            type="submit"
            disabled={inviting || !email}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {inviting ? "Inviting..." : "Generate Link"}
          </button>
        </form>
      </div>

      {invites.filter((i) => !i.accepted_at).length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-medium text-zinc-900 dark:text-zinc-50">
            Pending Invites
          </h3>
          <div className="space-y-2">
            {invites
              .filter((i) => !i.accepted_at)
              .map((invite) => (
                <div
                  key={invite.id}
                  className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-3 dark:border-zinc-700"
                >
                  <div>
                    <p className="text-sm text-zinc-900 dark:text-zinc-50">
                      {invite.email}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Expires{" "}
                      {new Date(invite.expires_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyInviteLink(invite.token)}
                    className="text-xs text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
                  >
                    {copiedToken === invite.token ? "Copied!" : "Copy Link"}
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
