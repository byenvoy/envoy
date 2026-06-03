"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

interface PostHogIdentifyProps {
  userId: string;
  email: string;
  orgId?: string | null;
  fullName?: string | null;
}

export function PostHogIdentify({ userId, email, orgId, fullName }: PostHogIdentifyProps) {
  useEffect(() => {
    if (!userId) return;
    posthog.identify(userId, {
      email,
      ...(orgId ? { org_id: orgId } : {}),
      ...(fullName ? { name: fullName } : {}),
    });
    if (orgId) {
      posthog.group("organization", orgId);
    }
  }, [userId, email, orgId, fullName]);

  return null;
}
