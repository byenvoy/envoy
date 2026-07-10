import puppeteer, { type Browser } from "puppeteer";
import Browserbase from "@browserbasehq/sdk";

export interface BrowserbaseSession {
  browser: Browser;
  sessionId: string;
  close: () => Promise<void>;
}

/**
 * Create a Browserbase cloud-browser session and connect Puppeteer to it. Unlike
 * the Fetch unblocker (no JS), this is a real browser: it clears bot protection
 * that blocks our server IP AND runs JS + clicks through tabs, so extractSingle
 * recovers the full content — e.g. the non-active FAQ tabs Fetch can't reach.
 *
 * Hosted-only: returns null when BROWSERBASE_API_KEY is unset or the session
 * can't start, so the caller falls back to the Fetch unblocker. projectId is
 * inferred from the API key; no proxies (the free tier clears Cloudflare).
 */
export async function connectBrowserbaseSession(): Promise<BrowserbaseSession | null> {
  const apiKey = process.env.BROWSERBASE_API_KEY;
  if (!apiKey) return null;

  try {
    const bb = new Browserbase({ apiKey });
    const session = await bb.sessions.create();
    const browser = await puppeteer.connect({
      browserWSEndpoint: session.connectUrl,
    });
    console.log(`[session] Browserbase session ${session.id} connected`);
    return {
      browser,
      sessionId: session.id,
      // Non-keepAlive sessions end when the CDP connection drops, so
      // disconnecting releases the cloud browser (and stops billing minutes).
      close: async () => {
        try {
          await browser.disconnect();
        } catch {
          // already gone
        }
      },
    };
  } catch (err) {
    console.warn(
      `[session] Browserbase session failed to start: ${err instanceof Error ? err.message : "unknown"}`
    );
    return null;
  }
}

// Renew before Browserbase's default 300s session timeout, so a large blocked
// job doesn't lose its tail to a mid-job timeout.
const SESSION_MAX_MS = 240_000;

export interface RenewingSession {
  /** Current session browser, transparently renewed as it nears the timeout. */
  browser(): Promise<Browser | null>;
  close(): Promise<void>;
  /** For per-job logging: how many sessions were spun up and total open time. */
  stats(): { sessions: number; totalMs: number };
}

/**
 * A Browserbase session that renews itself as it approaches the timeout, so a
 * long-running extraction job keeps full-browser extraction for all its pages
 * instead of degrading to Fetch once one session times out. Returns null
 * browsers when the unblocker is unavailable (caller falls back to Fetch).
 */
export function createRenewingSession(
  maxMs = SESSION_MAX_MS
): RenewingSession {
  let current: BrowserbaseSession | null = null;
  let startedAt = 0;
  let sessions = 0;
  let totalMs = 0;

  return {
    async browser() {
      const now = Date.now();
      if (current && now - startedAt > maxMs) {
        totalMs += now - startedAt;
        await current.close();
        current = null;
      }
      if (!current) {
        current = await connectBrowserbaseSession();
        if (current) {
          startedAt = Date.now();
          sessions++;
        }
      }
      return current?.browser ?? null;
    },
    async close() {
      if (current) {
        totalMs += Date.now() - startedAt;
        await current.close();
        current = null;
      }
    },
    stats() {
      return { sessions, totalMs };
    },
  };
}
