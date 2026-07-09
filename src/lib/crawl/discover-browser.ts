import puppeteer from "puppeteer";
import { isSupportRelevant, isStaticAsset, isNegativeFiltered } from "./discover";

const BROWSER_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

/**
 * Puppeteer-based URL discovery. Loads the homepage to establish a browser
 * session on the target domain, then uses in-page fetch() to retrieve
 * sitemaps (same-origin, carries cookies, bypasses Cloudflare WAF).
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

  try {
    const page = await browser.newPage();
    await page.setUserAgent(BROWSER_UA);
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false });
    });

    // Load homepage to establish same-origin context + Cloudflare cookies
    console.log(`[discover-browser] Loading homepage`);
    try {
      await page.goto(baseUrl, { waitUntil: "networkidle2", timeout: 20000 });
      console.log(`[discover-browser] Homepage loaded`);
    } catch {
      console.log(`[discover-browser] Homepage timed out, continuing`);
    }

    // Now fetch sitemaps via in-page fetch() (same-origin, carries cookies)
    console.log(`[discover-browser] Fetching robots.txt`);
    const sitemapUrls = await inPageFetchText(page, `${baseUrl}/robots.txt`)
      .then(parseSitemapUrlsFromRobots);
    console.log(`[discover-browser] Found ${sitemapUrls.length} sitemap URLs in robots.txt`);

    if (sitemapUrls.length === 0) {
      sitemapUrls.push(`${baseUrl}/sitemap.xml`);
    }

    // Fetch and parse each sitemap
    const allPageUrls: string[] = [];
    for (const sitemapUrl of sitemapUrls.slice(0, 3)) {
      console.log(`[discover-browser] Fetching sitemap: ${sitemapUrl}`);
      const urls = await inPageFetchText(page, sitemapUrl).then(parseLocUrls);
      console.log(`[discover-browser] Got ${urls.length} URLs`);

      // If it's a sitemap index, follow child sitemaps
      if (urls.length > 0 && urls.every((u) => u.endsWith(".xml"))) {
        const children = prioritizeSitemapChildren(urls).slice(0, 5);
        for (const child of children) {
          console.log(`[discover-browser] Fetching child: ${child}`);
          const childUrls = await inPageFetchText(page, child).then(parseLocUrls);
          console.log(`[discover-browser] Child: ${childUrls.length} URLs`);
          allPageUrls.push(...childUrls);
        }
      } else {
        allPageUrls.push(...urls);
      }
    }

    await page.close();
    console.log(`[discover-browser] Done, ${allPageUrls.length} total URLs before filtering`);

    // Filter, deduplicate, sort
    const filtered = [...new Set(allPageUrls)].filter((url) => {
      try {
        const host = new URL(url).hostname;
        return host === baseHost && !isStaticAsset(url) && !isNegativeFiltered(url);
      } catch {
        return false;
      }
    });

    const cleaned = [...new Set(filtered.map((u) => u.split("#")[0]))];

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

/** Fetch a URL as text from within the page context (same-origin, carries cookies) */
async function inPageFetchText(
  page: Awaited<ReturnType<Awaited<ReturnType<typeof puppeteer.launch>>["newPage"]>>,
  url: string
): Promise<string> {
  try {
    return await page.evaluate(async (fetchUrl: string) => {
      const res = await fetch(fetchUrl);
      if (!res.ok) return "";
      return res.text();
    }, url);
  } catch {
    return "";
  }
}

function parseSitemapUrlsFromRobots(text: string): string[] {
  const urls: string[] = [];
  for (const line of text.split("\n")) {
    const match = line.match(/^Sitemap:\s*(.+)/i);
    if (match) urls.push(match[1].trim());
  }
  return urls;
}

function parseLocUrls(text: string): string[] {
  const urls: string[] = [];
  const locRegex = /<loc>\s*(.*?)\s*<\/loc>/gi;
  let match;
  while ((match = locRegex.exec(text)) !== null) {
    urls.push(match[1]);
  }
  return urls;
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
