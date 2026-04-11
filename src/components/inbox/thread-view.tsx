"use client";

import { useMemo, useState } from "react";
import { marked, Renderer } from "marked";
import { StatusBadge } from "./status-badge";
import { stripQuotedReply } from "@/lib/email/strip-quotes";
import type { Conversation, Message } from "@/lib/types/database";

const threadRenderer = new Renderer();
threadRenderer.link = ({ href, text }) =>
  `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`;

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
  hideMobileHeader?: boolean;
}

export function ThreadPanel({ conversation, messages, onClose, closing, hideMobileHeader }: ThreadPanelProps) {
  // Most recent message starts expanded, others collapsed
  const lastIndex = messages.length - 1;
  const canClose = conversation.status !== "closed";

  return (
    <div>
      {/* Thread header — hidden on mobile when parent provides unified header bar */}
      <div className={`mb-4 ${hideMobileHeader ? "hidden md:block" : ""}`}>
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-lg font-bold tracking-tight text-text-primary">
            {conversation.subject || "(no subject)"}
          </h2>
          <div className="flex items-center gap-2">
            {canClose && onClose ? (
              <button
                onClick={onClose}
                disabled={closing}
                className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-alt disabled:opacity-50"
              >
                {closing ? "Closing..." : "Close"}
              </button>
            ) : (
              <StatusBadge status={conversation.status} />
            )}
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

  const renderedHtml = useMemo(() => {
    if (!displayBody) return null;
    return marked.parse(displayBody, { breaks: true, async: false, renderer: threadRenderer }) as string;
  }, [displayBody]);

  return (
    <div className="py-3">
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
          {/* Header line: name, time — clickable to toggle */}
          <div
            className="flex cursor-pointer items-center gap-2"
            onClick={() => setExpanded(!expanded)}
          >
            <span className={`font-display text-sm font-semibold ${isOutbound ? "text-primary" : "text-text-primary"}`}>
              {name}
            </span>
            {isOutbound && message.sent_by_autopilot && (
              <span className="inline-flex items-center gap-1 rounded-full bg-success-light px-2 py-0.5 text-[10px] font-medium text-primary">
                <svg className="h-2.5 w-2.5" viewBox="0 0 12 12" fill="none">
                  <path d="M6 1L7.5 4.5L11 6L7.5 7.5L6 11L4.5 7.5L1 6L4.5 4.5L6 1Z" fill="currentColor" />
                </svg>
                Auto-sent
              </span>
            )}
            <span className="font-mono text-xs text-text-secondary">
              {new Date(message.sent_at).toLocaleString()}
            </span>
          </div>

          {/* Collapsed: one-line preview — clickable to expand */}
          {!expanded && (() => {
            const preview = getPreview(message.body_text);
            return (
              <p
                className="mt-0.5 cursor-pointer truncate text-sm text-text-secondary"
                onClick={() => setExpanded(true)}
              >
                {preview.text}{preview.truncated && "..."}
              </p>
            );
          })()}

          {/* Expanded: full body */}
          {expanded && (
            <div className="mt-2">
              {renderedHtml ? (
                <div
                  className="overflow-x-auto break-words font-mono text-[13px] leading-relaxed text-text-primary [&_a]:text-primary [&_a]:underline [&_p]:mb-2 [&_p:last-child]:mb-0"
                  dangerouslySetInnerHTML={{ __html: renderedHtml }}
                />
              ) : (
                <p className="whitespace-pre-wrap font-mono text-[13px] leading-relaxed text-text-primary">
                  {displayBody || "(empty)"}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
