// Bot-protection detection + Browserbase Fetch unblocker. When a site's bot
// protection (e.g. Cloudflare) blocks our server IP, Browserbase Fetch retrieves
// the page through a real browser UA on Browserbase's network, which clears it.
// Validated against goodmoodprints.com (Cloudflare) on the free tier.
//
// Hosted-only: the unblocker no-ops (returns null) when BROWSERBASE_API_KEY is
// unset, so self-hosted / dev deployments fall back to the other tiers.

const BROWSERBASE_FETCH_ENDPOINT = "https://api.browserbase.com/v1/fetch";

const BROWSER_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export function isUnblockerEnabled(): boolean {
  return !!process.env.BROWSERBASE_API_KEY;
}

// --- Bot-protection detection ---

export type BlockReason = "cloudflare" | "bot-protection";

export interface BlockInfo {
  reason: BlockReason;
  evidence: string;
}

/**
 * Classify a response as a bot-protection block. A 403/429/503 from Cloudflare
 * (identified by the `server`/`cf-ray`/`cf-mitigated` headers) is the case we
 * care about — the plain-fetch tier can't clear it, so the caller should route
 * to the unblocker rather than report a failure.
 */
function classifyBlock(res: Response): BlockInfo | null {
  const blockedStatus =
    res.status === 403 || res.status === 429 || res.status === 503;
  if (!blockedStatus) return null;

  const server = res.headers.get("server")?.toLowerCase() ?? "";
  const isCloudflare =
    server.includes("cloudflare") ||
    res.headers.has("cf-ray") ||
    res.headers.has("cf-mitigated");

  return isCloudflare
    ? { reason: "cloudflare", evidence: `HTTP ${res.status} (cloudflare)` }
    : { reason: "bot-protection", evidence: `HTTP ${res.status}` };
}

/**
 * Cheaply probe a URL for a bot-protection block. Uses HEAD (no body) and falls
 * back to GET for servers that reject HEAD. Returns null on network errors —
 * those are not a definitive block signal.
 */
export async function probeBlock(url: string): Promise<BlockInfo | null> {
  try {
    let res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": BROWSER_UA },
    });
    if (res.status === 405 || res.status === 501) {
      res = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: AbortSignal.timeout(8000),
        headers: { "User-Agent": BROWSER_UA },
      });
    }
    res.body?.cancel().catch(() => {});
    return classifyBlock(res);
  } catch {
    return null;
  }
}

// --- Browserbase Fetch unblocker ---

/**
 * Fetch a URL's raw body through Browserbase Fetch. Returns the body text, or
 * null on any failure (unset key, network error, non-2xx target, or a target
 * status >= 400). Shaped as a drop-in for the plain `fetchText` primitive so
 * both discovery (sitemaps) and extraction (page HTML) can run through it.
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
    if (!res.ok) {
      console.warn(`[unblock] Browserbase API ${res.status} for ${url}`);
      return null;
    }

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
      if (typeof status === "number" && status >= 400) {
        console.warn(`[unblock] target returned ${status} via Browserbase for ${url}`);
        return null;
      }
      const body = (e.content ?? e.body ?? e.raw ?? e.data) as
        | string
        | undefined;
      return typeof body === "string" ? body : null;
    }

    return text;
  } catch (err) {
    console.warn(
      `[unblock] Browserbase fetch failed for ${url}: ${err instanceof Error ? err.message : "unknown"}`
    );
    return null;
  }
}
