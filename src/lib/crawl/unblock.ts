// Browserbase Fetch — the Tier-2 unblocker for discovery. When a site's bot
// protection (e.g. Cloudflare) blocks our server IP, Browserbase Fetch retrieves
// the page through a real browser UA on Browserbase's network, which clears it.
// Validated against goodmoodprints.com (Cloudflare) on the free tier.
//
// Hosted-only: no-ops (returns null) when BROWSERBASE_API_KEY is unset, so
// self-hosted / dev deployments fall back to the other discovery tiers.

const BROWSERBASE_FETCH_ENDPOINT = "https://api.browserbase.com/v1/fetch";

export function isUnblockerEnabled(): boolean {
  return !!process.env.BROWSERBASE_API_KEY;
}

/**
 * Fetch a URL's raw body through Browserbase Fetch. Returns the body text, or
 * null on any failure (unset key, network error, non-2xx target, or a target
 * status >= 400). Shaped as a drop-in for the plain `fetchText` primitive in
 * discover.ts so the sitemap signals can run through it unchanged.
 */
export async function fetchViaUnblocker(url: string): Promise<string | null> {
  const apiKey = process.env.BROWSERBASE_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(BROWSERBASE_FETCH_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-BB-API-Key": apiKey,
      },
      body: JSON.stringify({ url, format: "raw" }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return null;

    const text = await res.text();

    // Fetch returns a JSON envelope: { status/statusCode, content/body/... }.
    // Fall back to treating the response as a raw body if it isn't JSON.
    let envelope: unknown;
    try {
      envelope = JSON.parse(text);
    } catch {
      return text;
    }

    if (envelope && typeof envelope === "object") {
      const e = envelope as Record<string, unknown>;
      const status = (e.status ?? e.statusCode) as number | undefined;
      if (typeof status === "number" && status >= 400) return null;
      const body = (e.content ?? e.body ?? e.raw ?? e.data) as
        | string
        | undefined;
      return typeof body === "string" ? body : null;
    }

    return text;
  } catch {
    return null;
  }
}
