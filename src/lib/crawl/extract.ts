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

async function extractSingle(url: string): Promise<ExtractedPage> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: { "User-Agent": "Envoyer/1.0 (knowledge-base crawler)" },
    });

    if (!res.ok) {
      return { url, title: null, markdown: null, contentHash: null, error: `HTTP ${res.status}` };
    }

    const html = await res.text();
    const dom = new JSDOM(html, { url });
    const doc = dom.window.document;

    // Extract title before stripping
    const title =
      doc.querySelector("title")?.textContent?.trim() || null;

    // Remove noise elements
    for (const tag of NOISE_TAGS) {
      doc.querySelectorAll(tag).forEach((el) => el.remove());
    }
    doc
      .querySelectorAll('[role="navigation"],[role="banner"],[role="contentinfo"]')
      .forEach((el) => el.remove());

    const body = doc.body;
    if (!body || !body.textContent?.trim()) {
      return { url, title, markdown: null, contentHash: null, error: "No readable content" };
    }

    const markdown = turndown.turndown(body.innerHTML);
    const contentHash = computeHash(markdown);

    return { url, title, markdown, contentHash };
  } catch (err) {
    return {
      url,
      title: null,
      markdown: null,
      contentHash: null,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function extractPages(urls: string[]): Promise<ExtractedPage[]> {
  const results: ExtractedPage[] = [];
  const batchSize = 5;

  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(extractSingle));
    results.push(...batchResults);
  }

  return results;
}
