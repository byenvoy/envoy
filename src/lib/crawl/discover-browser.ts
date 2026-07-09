import puppeteer from "puppeteer";
import { isSupportRelevant, isStaticAsset, isNegativeFiltered } from "./discover";

const BROWSER_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

// Hard cap so the job never hangs the worker
const DISCOVER_TIMEOUT_MS = 45_000;

/**
 * Puppeteer-based URL discovery fallback. Launches a headless browser,
 * loads the homepage, and extracts all same-domain links. Used by the
 * worker when fetch-based discovery returns 0 results (e.g. Cloudflare-
 * protected sites).
 */
export async function discoverWithBrowser(domain: string): Promise<string[]> {
  const baseUrl = domain.startsWith("http") ? domain : `https://${domain}`;
  const baseHost = new URL(baseUrl).hostname;

  const browser = await puppeteer.launch({
    headless: "shell",
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--disable-software-rasterizer",
      "--disable-blink-features=AutomationControlled",
    ],
  });

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Browser discover timed out")), DISCOVER_TIMEOUT_MS)
  );

  try {
    return await Promise.race([discoverPages(browser, baseUrl, baseHost), timeout]);
  } finally {
    await browser.close();
  }
}

async function discoverPages(
  browser: Awaited<ReturnType<typeof puppeteer.launch>>,
  baseUrl: string,
  baseHost: string
): Promise<string[]> {
  const page = await browser.newPage();
  await page.setUserAgent(BROWSER_UA);
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
  });

  // Load homepage and extract all links
  const response = await page.goto(baseUrl, { waitUntil: "networkidle2", timeout: 20000 });

  // Detect Cloudflare challenge pages — no useful links to extract
  const title = await page.title();
  const isChallenge =
    !response?.ok() ||
    title.toLowerCase().includes("attention required") ||
    title.toLowerCase().includes("just a moment");

  let hrefs: string[] = [];
  if (!isChallenge) {
    hrefs = await page.evaluate(() =>
      Array.from(document.querySelectorAll("a[href]"), (a) =>
        (a as HTMLAnchorElement).href
      )
    );
  }

  // Try sitemap via the browser (faster timeout since it's supplementary)
  const sitemapUrls = await extractSitemapUrls(page, baseUrl);

  await page.close();

  // Merge, deduplicate, and filter
  const allUrls = [...new Set([...hrefs, ...sitemapUrls])];

  const filtered = allUrls.filter((url) => {
    try {
      const host = new URL(url).hostname;
      return (
        host === baseHost &&
        !isStaticAsset(url) &&
        !isNegativeFiltered(url)
      );
    } catch {
      return false;
    }
  });

  // Strip fragments
  const cleaned = [...new Set(filtered.map((u) => u.split("#")[0]))];

  // Sort: support-relevant first
  const support: string[] = [];
  const rest: string[] = [];
  for (const url of cleaned) {
    if (isSupportRelevant(url)) {
      support.push(url);
    } else {
      rest.push(url);
    }
  }

  return [...support, ...rest];
}

async function extractSitemapUrls(
  page: Awaited<ReturnType<Awaited<ReturnType<typeof puppeteer.launch>>["newPage"]>>,
  baseUrl: string
): Promise<string[]> {
  try {
    // Try robots.txt first to find sitemap URL
    const robotsResponse = await page.goto(`${baseUrl}/robots.txt`, {
      waitUntil: "networkidle2",
      timeout: 10000,
    });

    if (!robotsResponse || !robotsResponse.ok()) return [];

    const robotsText = await page.evaluate(() => document.body.innerText);
    const sitemapUrls: string[] = [];
    for (const line of robotsText.split("\n")) {
      const match = line.match(/^Sitemap:\s*(.+)/i);
      if (match) sitemapUrls.push(match[1].trim());
    }

    if (sitemapUrls.length === 0) {
      sitemapUrls.push(`${baseUrl}/sitemap.xml`);
    }

    const pageUrls: string[] = [];
    for (const sitemapUrl of sitemapUrls.slice(0, 2)) {
      const res = await page.goto(sitemapUrl, {
        waitUntil: "networkidle2",
        timeout: 10000,
      });
      if (!res || !res.ok()) continue;

      const text = await page.evaluate(() => document.body.innerText);
      const locRegex = /<loc>\s*(.*?)\s*<\/loc>/gi;
      let match;
      while ((match = locRegex.exec(text)) !== null) {
        pageUrls.push(match[1]);
      }

      // If it's a sitemap index, follow child sitemaps (limit to 3)
      if (pageUrls.length > 0 && pageUrls.every((u) => u.endsWith(".xml"))) {
        const children = [...pageUrls];
        pageUrls.length = 0;
        for (const child of children.slice(0, 3)) {
          const childRes = await page.goto(child, {
            waitUntil: "networkidle2",
            timeout: 10000,
          });
          if (!childRes || !childRes.ok()) continue;
          const childText = await page.evaluate(() => document.body.innerText);
          let childMatch;
          while ((childMatch = locRegex.exec(childText)) !== null) {
            pageUrls.push(childMatch[1]);
          }
        }
      }
    }

    return pageUrls;
  } catch {
    return [];
  }
}
