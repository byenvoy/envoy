import { PostHogAnthropic } from "@posthog/ai/anthropic";
import { getPostHogClient } from "@/lib/posthog-server";

export function createAgentClient(apiKey: string): PostHogAnthropic {
  return new PostHogAnthropic({
    apiKey,
    posthog: getPostHogClient(),
  });
}
