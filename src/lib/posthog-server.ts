import { PostHog } from "posthog-node";

let posthogClient: PostHog | null = null;

export function getPostHogClient() {
  if (!posthogClient) {
    posthogClient = new PostHog(
      process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN!,
      {
        host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
        flushAt: 1,
        flushInterval: 0,
      },
    );
  }
  return posthogClient;
}

export function captureEvent(
  userId: string,
  orgId: string,
  event: string,
  properties?: Record<string, unknown>,
) {
  getPostHogClient().capture({
    distinctId: userId,
    event,
    groups: { organization: orgId },
    properties: { org_id: orgId, ...properties },
  });
}

export async function shutdownPostHog() {
  if (posthogClient) {
    await posthogClient.shutdown();
  }
}
