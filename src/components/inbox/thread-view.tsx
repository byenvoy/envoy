"use client";

import { useState } from "react";
import { StatusBadge } from "./status-badge";
import { stripQuotedReply } from "@/lib/email/strip-quotes";
import type { Conversation, Message } from "@/lib/types/database";

function getInitials(name: string | null, email: string): string {
  if (name) {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  return email[0]?.toUpperCase() ?? "?";
}

function getPreview(body: string | null): { text: string; truncated: boolean } {
  if (!body) return { text: "(empty)", truncated: false };
  const stripped = stripQuotedReply(body);
  const lines = stripped.split("\n").filter((l) => l.trim().length > 0);
  const firstLine = lines[0] ?? "";
  const hasMore = lines.length > 1 || firstLine.length > 120;
  const text = firstLine.length > 120 ? firstLine.slice(0, 120) : firstLine;
  return { text, truncated: hasMore };
}

interface ThreadPanelProps {
  conversation: Conversation;
  messages: Message[];
  onClose?: () => void;
  closing?: boolean;
}

export function ThreadPanel({ conversation, messages, onClose, closing }: ThreadPanelProps) {
  // Most recent message starts expanded, others collapsed
  const lastIndex = messages.length - 1;
  const canClose = conversation.status !== "closed";

  return (
    <div>
      {/* Thread header */}
      <div className="mb-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-lg font-bold tracking-tight text-text-primary">
            {conversation.subject || "(no subject)"}
          </h2>
          <div className="flex items-center gap-2">
            {canClose && onClose && (
              <button
                onClick={onClose}
                disabled={closing}
                className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-alt disabled:opacity-50"
              >
                {closing ? "Closing..." : "Close"}
              </button>
            )}
            <StatusBadge status={conversation.status} />
          </div>
        </div>
        <p className="mt-1 font-mono text-xs text-text-secondary">
          {conversation.customer_name
            ? `${conversation.customer_name} <${conversation.customer_email}>`
            : conversation.customer_email}
          {" \u00B7 "}
          {messages.length} message{messages.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Messages */}
      <div className="divide-y divide-border">
        {messages.map((msg, i) => (
          <MessageRow
            key={msg.id}
            message={msg}
            isOutbound={msg.direction === "outbound"}
            defaultExpanded={i === lastIndex}
          />
        ))}
      </div>
    </div>
  );
}

function MessageRow({
  message,
  isOutbound,
  defaultExpanded,
}: {
  message: Message;
  isOutbound: boolean;
  defaultExpanded: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const name = message.from_name || message.from_email;
  const displayBody = message.body_text
    ? stripQuotedReply(message.body_text)
    : null;

  return (
    <div
      className="cursor-pointer py-3"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex gap-3">
        {/* Avatar */}
        <div
          className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full font-display text-[10px] font-bold text-white ${
            isOutbound ? "bg-primary" : ""
          }`}
          style={isOutbound ? undefined : { backgroundColor: "#7C6F64" }}
        >
          {isOutbound ? "E" : getInitials(name !== message.from_email ? name : null, message.from_email)}
        </div>

        <div className="min-w-0 flex-1">
          {/* Header line: name, time */}
          <div className="flex items-center gap-2">
            <span className={`font-display text-sm font-semibold ${isOutbound ? "text-primary" : "text-text-primary"}`}>
              {name}
            </span>
            <span className="font-mono text-xs text-text-secondary">
              {new Date(message.created_at).toLocaleString()}
            </span>
          </div>

          {/* Collapsed: one-line preview */}
          {!expanded && (() => {
            const preview = getPreview(message.body_text);
            return (
              <p className="mt-0.5 truncate text-sm text-text-secondary">
                {preview.text}{preview.truncated && "..."}
              </p>
            );
          })()}

          {/* Expanded: full body */}
          {expanded && (
            <div className="mt-2">
              <p className="whitespace-pre-wrap font-mono text-[13px] leading-relaxed text-text-primary">
                {displayBody || "(empty)"}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
