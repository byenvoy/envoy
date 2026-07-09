import puppeteer from "puppeteer";
import { isSupportRelevant, isStaticAsset, isNegativeFiltered } from "./discover";

const BROWSER_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

/**
 * Puppeteer-based URL discovery fallback. Fetches sitemaps through a real
 * browser to bypass Cloudflare JS challenges that block plain fetch.
 * Deliberately lightweight — only loads XML sitemaps, no heavy HTML pages.
 */
export async function discoverWithBrowser(domain: string): Promise<string[]> {
  const baseUrl = domain.startsWith("http") ? domain : `https://${domain}`;
  const baseHost = new URL(baseUrl).hostname;

  console.log(`[discover-browser] Starting for ${domain}`);
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

  console.log(`[discover-browser] Browser launched`);
  try {
    const page = await browser.newPage();
    console.log(`[discover-browser] Page created`);
    await page.setUserAgent(BROWSER_UA);
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false });
    });

    // 0. Load homepage to establish Cloudflare clearance cookie
    console.log(`[discover-browser] Loading homepage for CF cookie`);
    try {
      await page.goto(baseUrl, { waitUntil: "networkidle2", timeout: 15000 });
      console.log(`[discover-browser] Homepage loaded`);
    } catch {
      console.log(`[discover-browser] Homepage timed out (continuing anyway)`);
    }

    // 1. Try robots.txt to find sitemap URLs
    console.log(`[discover-browser] Fetching robots.txt`);
    const sitemapUrls = await getSitemapUrlsFromRobots(page, baseUrl);
    console.log(`[discover-browser] robots.txt done, found ${sitemapUrls.length} sitemap URLs`);
    if (sitemapUrls.length === 0) {
      sitemapUrls.push(`${baseUrl}/sitemap.xml`);
    }

    // 2. Fetch and parse each sitemap
    const allPageUrls: string[] = [];
    for (const sitemapUrl of sitemapUrls.slice(0, 3)) {
      console.log(`[discover-browser] Fetching sitemap: ${sitemapUrl}`);
      const urls = await fetchSitemap(page, sitemapUrl);
      console.log(`[discover-browser] Sitemap done: ${urls.length} URLs`);

      // If it's a sitemap index, follow children
      if (urls.length > 0 && urls.every((u) => u.endsWith(".xml"))) {
        const children = prioritizeSitemapChildren(urls).slice(0, 5);
        for (const child of children) {
          console.log(`[discover-browser] Fetching child sitemap: ${child}`);
          const childUrls = await fetchSitemap(page, child);
          console.log(`[discover-browser] Child sitemap done: ${childUrls.length} URLs`);
          allPageUrls.push(...childUrls);
        }
      } else {
        allPageUrls.push(...urls);
      }
    }

    await page.close();

    // Filter to same-domain, non-static, non-negative
    const filtered = [...new Set(allPageUrls)].filter((url) => {
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

    // Strip fragments and deduplicate
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

async function getSitemapUrlsFromRobots(
  page: Awaited<ReturnType<Awaited<ReturnType<typeof puppeteer.launch>>["newPage"]>>,
  baseUrl: string
): Promise<string[]> {
  try {
    const res = await page.goto(`${baseUrl}/robots.txt`, {
      waitUntil: "networkidle2",
      timeout: 10000,
    });
    if (!res || !res.ok()) return [];

    const text = await page.evaluate(() => document.body.innerText);
    const urls: string[] = [];
    for (const line of text.split("\n")) {
      const match = line.match(/^Sitemap:\s*(.+)/i);
      if (match) urls.push(match[1].trim());
    }
    return urls;
  } catch {
    return [];
  }
}

async function fetchSitemap(
  page: Awaited<ReturnType<Awaited<ReturnType<typeof puppeteer.launch>>["newPage"]>>,
  url: string
): Promise<string[]> {
  try {
    const res = await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 10000,
    });
    if (!res || !res.ok()) return [];

    const text = await page.evaluate(() => document.body.innerText);
    const urls: string[] = [];
    const locRegex = /<loc>\s*(.*?)\s*<\/loc>/gi;
    let match;
    while ((match = locRegex.exec(text)) !== null) {
      urls.push(match[1]);
    }
    return urls;
  } catch {
    return [];
  }
}

const PRODUCT_SITEMAP = /product|collect/i;
const SUPPORT_SITEMAP = /page|content|blog|support|help|faq|article|guide|custom/i;

function prioritizeSitemapChildren(urls: string[]): string[] {
  const support: string[] = [];
  const other: string[] = [];
  const product: string[] = [];

  for (const url of urls) {
    const filename = url.split("/").pop() || "";
    if (SUPPORT_SITEMAP.test(filename)) {
      support.push(url);
    } else if (PRODUCT_SITEMAP.test(filename)) {
      product.push(url);
    } else {
      other.push(url);
    }
  }

  return [...support, ...other, ...product];
}
