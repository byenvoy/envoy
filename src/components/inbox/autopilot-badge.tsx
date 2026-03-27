"use client";

import type { AutopilotOutcome } from "@/lib/types/database";

interface AutopilotBadgeProps {
  outcome: AutopilotOutcome;
  sentByAutopilot: boolean;
}

export function AutopilotBadge({ outcome, sentByAutopilot }: AutopilotBadgeProps) {
  if (sentByAutopilot) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success-light px-2 py-0.5 text-[10px] font-medium text-primary">
        <svg className="h-2.5 w-2.5" viewBox="0 0 12 12" fill="none">
          <path d="M6 1L7.5 4.5L11 6L7.5 7.5L6 11L4.5 7.5L1 6L4.5 4.5L6 1Z" fill="currentColor" />
        </svg>
        Auto-sent
      </span>
    );
  }

  if (outcome === "shadow_tagged") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-ai-light px-2 py-0.5 text-[10px] font-medium text-ai">
        <svg className="h-2.5 w-2.5" viewBox="0 0 12 12" fill="none">
          <path d="M6 1L7.5 4.5L11 6L7.5 7.5L6 11L4.5 7.5L1 6L4.5 4.5L6 1Z" fill="currentColor" />
        </svg>
        Shadow
      </span>
    );
  }

  return null;
}
