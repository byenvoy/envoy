import puppeteer from "puppeteer";
import { isSupportRelevant, isStaticAsset, isNegativeFiltered } from "./discover";

const BROWSER_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

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

  try {
    const page = await browser.newPage();
    await page.setUserAgent(BROWSER_UA);
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false });
    });

    // Load homepage and extract all links
    await page.goto(baseUrl, { waitUntil: "networkidle2", timeout: 30000 });

    const hrefs: string[] = await page.evaluate(() =>
      Array.from(document.querySelectorAll("a[href]"), (a) =>
        (a as HTMLAnchorElement).href
      )
    );

    // Also try sitemap via the browser (bypasses Cloudflare JS challenge)
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
  } finally {
    await browser.close();
  }
}

async function extractSitemapUrls(
  page: Awaited<ReturnType<Awaited<ReturnType<typeof puppeteer.launch>>["newPage"]>>,
  baseUrl: string
): Promise<string[]> {
  try {
    // Try robots.txt first to find sitemap URL
    const robotsResponse = await page.goto(`${baseUrl}/robots.txt`, {
      waitUntil: "networkidle2",
      timeout: 15000,
    });

    if (!robotsResponse || !robotsResponse.ok()) return [];

    const robotsText = await page.evaluate(() => document.body.innerText);
    const sitemapUrls: string[] = [];
    for (const line of robotsText.split("\n")) {
      const match = line.match(/^Sitemap:\s*(.+)/i);
      if (match) sitemapUrls.push(match[1].trim());
    }

    if (sitemapUrls.length === 0) {
      // Fall back to default sitemap.xml
      sitemapUrls.push(`${baseUrl}/sitemap.xml`);
    }

    const pageUrls: string[] = [];
    for (const sitemapUrl of sitemapUrls.slice(0, 3)) {
      const res = await page.goto(sitemapUrl, {
        waitUntil: "networkidle2",
        timeout: 15000,
      });
      if (!res || !res.ok()) continue;

      const text = await page.evaluate(() => document.body.innerText);
      const locRegex = /<loc>\s*(.*?)\s*<\/loc>/gi;
      let match;
      while ((match = locRegex.exec(text)) !== null) {
        pageUrls.push(match[1]);
      }

      // If it's a sitemap index, follow child sitemaps
      if (pageUrls.every((u) => u.endsWith(".xml"))) {
        const children = [...pageUrls];
        pageUrls.length = 0;
        for (const child of children.slice(0, 5)) {
          const childRes = await page.goto(child, {
            waitUntil: "networkidle2",
            timeout: 15000,
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
