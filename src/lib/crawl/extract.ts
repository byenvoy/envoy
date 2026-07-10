import puppeteer, { type Browser, type Page } from "puppeteer";
import { JSDOM } from "jsdom";
import TurndownService from "turndown";
import { computeHash } from "./hash";
import { fetchViaUnblocker, isUnblockerEnabled, probeBlock } from "./unblock";
import { createRenewingSession } from "./session";

const BROWSER_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const NOISE_TAGS = [
  "script",
  "style",
  "nav",
  "header",
  "footer",
  "svg",
  "iframe",
  "noscript",
];

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
});

// Strip images
turndown.addRule("images", {
  filter: "img",
  replacement: () => "",
});

export interface ExtractedPage {
  url: string;
  title: string | null;
  markdown: string | null;
  contentHash: string | null;
  error?: string;
}

function htmlToMarkdown(html: string, url: string): ExtractedPage {
  const dom = new JSDOM(html, { url });
  const doc = dom.window.document;

  const title = doc.querySelector("title")?.textContent?.trim() || null;

  for (const tag of NOISE_TAGS) {
    doc.querySelectorAll(tag).forEach((el) => el.remove());
  }
  doc
    .querySelectorAll('[role="navigation"],[role="banner"],[role="contentinfo"]')
    .forEach((el) => el.remove());

  // Resolve relative URLs to absolute before converting to markdown
  doc.querySelectorAll("a[href]").forEach((el) => {
    try {
      const href = el.getAttribute("href");
      if (href && !href.startsWith("http") && !href.startsWith("mailto:")) {
        const absolute = new URL(href, url).href;
        el.setAttribute("href", absolute);
      }
    } catch {
      // Invalid URL — leave as-is
    }
  });

  const body = doc.body;
  if (!body || !body.textContent?.trim()) {
    return { url, title, markdown: null, contentHash: null, error: "No readable content" };
  }

  const markdown = turndown.turndown(body.innerHTML);
  const contentHash = computeHash(markdown);

  return { url, title, markdown, contentHash };
}

function mergeTabContent(snapshots: string[], url: string): ExtractedPage {
  // Convert each snapshot to markdown, then combine unique parts
  const pages = snapshots.map((html) => htmlToMarkdown(html, url));
  const title = pages[0]?.title ?? null;

  // Find the common prefix/header across all tabs (page chrome, tab labels, etc.)
  const markdowns = pages
    .map((p) => p.markdown)
    .filter((m): m is string => m !== null);

  if (markdowns.length === 0) {
    return { url, title, markdown: null, contentHash: null, error: "No readable content" };
  }

  // Split each markdown into lines and find where they diverge
  const lineArrays = markdowns.map((m) => m.split("\n"));
  let commonPrefixEnd = 0;
  const minLen = Math.min(...lineArrays.map((l) => l.length));
  for (let i = 0; i < minLen; i++) {
    if (lineArrays.every((lines) => lines[i] === lineArrays[0][i])) {
      commonPrefixEnd = i + 1;
    } else {
      break;
    }
  }

  // Find common suffix (footer)
  let commonSuffixStart = 0;
  for (let i = 1; i <= minLen; i++) {
    if (lineArrays.every((lines) => lines[lines.length - i] === lineArrays[0][lineArrays[0].length - i])) {
      commonSuffixStart = i;
    } else {
      break;
    }
  }

  // Build merged content: shared header + each tab's unique content + shared footer
  const header = lineArrays[0].slice(0, commonPrefixEnd).join("\n");
  const footer = commonSuffixStart > 0
    ? lineArrays[0].slice(lineArrays[0].length - commonSuffixStart).join("\n")
    : "";

  const uniqueParts = lineArrays.map((lines) => {
    const end = commonSuffixStart > 0 ? lines.length - commonSuffixStart : lines.length;
    return lines.slice(commonPrefixEnd, end).join("\n").trim();
  });

  const sections = uniqueParts.filter((p) => p.length > 0);
  const merged = [header, ...sections, footer].filter((p) => p.length > 0).join("\n\n---\n\n");
  const contentHash = computeHash(merged);

  return { url, title, markdown: merged, contentHash };
}

const ARIA_TAB_SELECTORS = [
  '[role="tab"]',
  '[role="tablist"] button',
  '[role="tablist"] a',
  '[data-tab]',
  '.tab-button',
  '.tabs button',
  '.tabs a',
];

async function findTabGroup(page: Page) {
  // First try standard ARIA/class-based selectors
  const ariaSelector = ARIA_TAB_SELECTORS.join(", ");
  const ariaTabs = await page.$$(ariaSelector);

  if (ariaTabs.length > 1) {
    // Deduplicate
    const seen = new Set<string>();
    const unique = [];
    for (const tab of ariaTabs) {
      const id = await page.evaluate((el) => el.outerHTML.slice(0, 200), tab);
      if (!seen.has(id)) {
        seen.add(id);
        unique.push(tab);
      }
    }
    if (unique.length > 1) return unique;
  }

  // Heuristic: find groups of short-text sibling elements that look like tabs
  const parentSelector = await page.evaluate(() => {
    const candidates = document.querySelectorAll("div, ul");
    for (const parent of candidates) {
      const children = Array.from(parent.children);
      if (children.length < 2 || children.length > 10) continue;

      const allShortText = children.every((c) => {
        const text = c.textContent?.trim() || "";
        return text.length > 0 && text.length < 60 && c.children.length === 0;
      });
      if (!allShortText) continue;

      // All children should be the same tag
      const tags = new Set(children.map((c) => c.tagName));
      if (tags.size > 1) continue;

      // Check they look like a horizontal group (common tab layout)
      const parentRect = parent.getBoundingClientRect();
      if (parentRect.height > 100) continue;

      // Return a unique selector for this parent
      const classes = parent.className?.toString().split(" ")[0];
      if (classes) return "." + classes;
    }
    return null;
  });

  if (!parentSelector) return null;

  const parent = await page.$(parentSelector);
  if (!parent) return null;

  return await parent.$$(":scope > *");
}

async function captureTabSnapshots(page: Page): Promise<string[]> {
  try {
    const tabs = await findTabGroup(page);
    if (!tabs || tabs.length <= 1) return [];

    const snapshots: string[] = [];

    for (const tab of tabs) {
      try {
        await tab.click();
        await page.evaluate(() => new Promise((r) => setTimeout(r, 800)));
        snapshots.push(await page.content());
      } catch {
        // Tab not clickable — skip
      }
    }

    return snapshots;
  } catch {
    return [];
  }
}

async function extractSingle(
  browser: Browser,
  url: string
): Promise<ExtractedPage> {
  const page = await browser.newPage();
  try {
    await page.setUserAgent(BROWSER_UA);
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false });
    });

    const response = await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    if (!response || !response.ok()) {
      const status = response?.status() ?? "unknown";
      return { url, title: null, markdown: null, contentHash: null, error: `HTTP ${status}` };
    }

    // Try to capture content from multiple tabs
    const tabSnapshots = await captureTabSnapshots(page);

    if (tabSnapshots.length > 1) {
      // Merge unique content from all tab snapshots
      return mergeTabContent(tabSnapshots, url);
    }

    const html = await page.content();
    return htmlToMarkdown(html, url);
  } catch (err) {
    return {
      url,
      title: null,
      markdown: null,
      contentHash: null,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  } finally {
    await page.close();
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

/**
 * Extract a page through the Browserbase unblocker (real browser UA on
 * Browserbase's network) instead of local Puppeteer. Used for bot-protected
 * sites where Puppeteer from our datacenter IP times out. Fetches the raw HTML
 * and runs it through the same markdown pipeline as the Puppeteer path.
 */
async function extractViaUnblocker(url: string): Promise<ExtractedPage> {
  const html = await fetchViaUnblocker(url);
  if (!html) {
    return { url, title: null, markdown: null, contentHash: null, error: "Unblocker fetch failed" };
  }
  return htmlToMarkdown(html, url);
}

/**
 * Cheap change-detection hash for a blocked page: fetch its Fetch-only render
 * (no JS/session) and hash the resulting markdown. Recrawl compares this to the
 * stored checkHash to decide whether a session re-extraction is even needed —
 * far cheaper than session-extracting every blocked page every cycle. Returns
 * null when the Fetch fails (caller then treats the page as changed).
 */
export async function fetchContentHash(url: string): Promise<string | null> {
  const html = await fetchViaUnblocker(url);
  if (!html) return null;
  const { markdown } = htmlToMarkdown(html, url);
  if (!markdown) return null;
  // Cloudflare's email obfuscation rotates a per-request token in
  // /cdn-cgi/l/email-protection#<hash> links; normalize it out so an unchanged
  // page hashes identically across recrawls.
  const normalized = markdown.replace(
    /email-protection#[0-9a-f]+/gi,
    "email-protection"
  );
  return computeHash(normalized);
}

/**
 * Detect which of the given hosts are bot-protected, so their pages skip
 * Puppeteer (which times out ~30s/page on a blocked datacenter IP) and go
 * straight to the unblocker. Only runs when the unblocker is available.
 */
async function detectBlockedHosts(urls: string[]): Promise<Set<string>> {
  const blocked = new Set<string>();
  if (!isUnblockerEnabled()) return blocked;

  const hosts = [...new Set(urls.map(hostOf).filter(Boolean))];
  await Promise.all(
    hosts.map(async (host) => {
      const info = await probeBlock(`https://${host}/`);
      if (info) {
        blocked.add(host);
        console.log(`[extract] ${host} is bot-protected (${info.evidence}); routing to Browserbase`);
      }
    })
  );
  return blocked;
}

async function extractOne(
  url: string,
  localBrowser: Browser | null,
  sessionBrowser: Browser | null,
  blockedHosts: Set<string>
): Promise<ExtractedPage> {
  if (blockedHosts.has(hostOf(url))) {
    // Tier 3: a Browserbase session runs full extractSingle (JS + tab-clicking),
    // recovering content the no-JS Fetch tier misses (e.g. non-active FAQ tabs).
    if (sessionBrowser) {
      const result = await extractSingle(sessionBrowser, url);
      if (!result.error) return result;
      console.log(`[extract] session extraction failed for ${url} (${result.error}); falling back to Fetch`);
    }
    // Tier 2 fallback: Fetch (no JS) when the session is unavailable or failed.
    return extractViaUnblocker(url);
  }

  const result = localBrowser
    ? await extractSingle(localBrowser, url)
    : { url, title: null, markdown: null, contentHash: null, error: "No browser available" };

  // Per-page safety net: a page on a host we didn't flag as blocked can still
  // fail (timeout / 403). Retry it through the unblocker when available.
  if (result.error && isUnblockerEnabled()) {
    console.log(`[extract] Puppeteer failed for ${url} (${result.error}); retrying via unblocker`);
    const viaUnblocker = await extractViaUnblocker(url);
    if (!viaUnblocker.error) return viaUnblocker;
  }

  return result;
}

export async function extractPages(
  urls: string[],
  onPage?: (page: ExtractedPage) => void | Promise<void>
): Promise<ExtractedPage[]> {
  const blockedHosts = await detectBlockedHosts(urls);
  const hasReachable = urls.some((url) => !blockedHosts.has(hostOf(url)));
  const hasBlocked = urls.some((url) => blockedHosts.has(hostOf(url)));

  // Local Puppeteer for reachable hosts (free, renders JS).
  const localBrowser = hasReachable
    ? await puppeteer.launch({
        headless: "shell",
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--disable-software-rasterizer", "--disable-blink-features=AutomationControlled"],
      })
    : null;

  // Tier 3: a renewing Browserbase session for blocked hosts — recreated as it
  // nears the 300s timeout so large blocked jobs keep full extraction instead
  // of degrading their tail to Fetch. Falls back to Fetch per page if a session
  // can't start.
  const session = hasBlocked ? createRenewingSession() : null;

  try {
    const results: ExtractedPage[] = [];
    const batchSize = 3;

    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize);
      // Only hold a session while a batch actually has blocked pages; the age
      // check (and any needed renewal) happens here, before the batch runs.
      const batchHasBlocked = batch.some((url) => blockedHosts.has(hostOf(url)));
      const sessionBrowser =
        session && batchHasBlocked ? await session.browser() : null;
      const batchResults = await Promise.all(
        batch.map((url) =>
          extractOne(url, localBrowser, sessionBrowser, blockedHosts)
        )
      );
      for (const page of batchResults) {
        results.push(page);
        if (onPage) await onPage(page);
      }
    }

    return results;
  } finally {
    if (localBrowser) await localBrowser.close();
    if (session) {
      await session.close();
      const { sessions, totalMs } = session.stats();
      if (sessions > 0) {
        console.log(
          `[extract] Browserbase: ${sessions} session(s), ~${Math.round(totalMs / 1000)}s total`
        );
      }
    }
  }
}
