import puppeteer, { type Browser, type Page } from "puppeteer";
import { JSDOM } from "jsdom";
import TurndownService from "turndown";
import { computeHash } from "./hash";

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
    await page.setUserAgent("Envoy/1.0 (knowledge-base crawler)");

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

export async function extractPages(
  urls: string[],
  onPage?: (page: ExtractedPage) => void | Promise<void>
): Promise<ExtractedPage[]> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const results: ExtractedPage[] = [];
    const batchSize = 3;

    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((url) => extractSingle(browser, url))
      );
      for (const page of batchResults) {
        results.push(page);
        if (onPage) await onPage(page);
      }
    }

    return results;
  } finally {
    await browser.close();
  }
}
