const URL_CAP = 200;

const SUPPORT_PATTERNS =
  /\/(support|faq|help|docs|knowledge|article|guide|tutorial|delivery|returns|shipping|terms)/i;

export function isSupportRelevant(url: string): boolean {
  try {
    const path = new URL(url).pathname;
    return SUPPORT_PATTERNS.test(path);
  } catch {
    return false;
  }
}

function normalizeUrl(input: string): string {
  let url = input.trim();
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  return url.replace(/\/+$/, "");
}

function sameDomain(base: string, candidate: string): boolean {
  try {
    const baseHost = new URL(base).hostname;
    const candidateHost = new URL(candidate).hostname;
    return baseHost === candidateHost;
  } catch {
    return false;
  }
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: { "User-Agent": "Envoyer/1.0 (knowledge-base crawler)" },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function parseSitemapUrls(xml: string): string[] {
  const urls: string[] = [];
  const locRegex = /<loc>\s*(.*?)\s*<\/loc>/gi;
  let match;
  while ((match = locRegex.exec(xml)) !== null) {
    urls.push(match[1]);
  }
  return urls;
}

async function trySitemap(baseUrl: string): Promise<string[]> {
  const xml = await fetchText(`${baseUrl}/sitemap.xml`);
  if (!xml) return [];

  let urls = parseSitemapUrls(xml);

  // Handle sitemap index — fetch child sitemaps
  if (urls.length > 0 && urls.every((u) => u.endsWith(".xml"))) {
    const childUrls: string[] = [];
    const children = urls.slice(0, 5); // limit child sitemaps
    for (const childUrl of children) {
      const childXml = await fetchText(childUrl);
      if (childXml) {
        childUrls.push(...parseSitemapUrls(childXml));
      }
    }
    urls = childUrls;
  }

  return urls.filter((u) => sameDomain(baseUrl, u));
}

async function tryRobotsSitemap(baseUrl: string): Promise<string[]> {
  const robots = await fetchText(`${baseUrl}/robots.txt`);
  if (!robots) return [];

  const sitemapUrls: string[] = [];
  for (const line of robots.split("\n")) {
    const match = line.match(/^Sitemap:\s*(.+)/i);
    if (match) sitemapUrls.push(match[1].trim());
  }

  const allUrls: string[] = [];
  for (const sitemapUrl of sitemapUrls.slice(0, 3)) {
    const xml = await fetchText(sitemapUrl);
    if (xml) allUrls.push(...parseSitemapUrls(xml));
  }

  return allUrls.filter((u) => sameDomain(baseUrl, u));
}

async function scrapeHomepageLinks(baseUrl: string): Promise<string[]> {
  const html = await fetchText(baseUrl);
  if (!html) return [];

  const urls = new Set<string>();
  const hrefRegex = /href=["'](.*?)["']/gi;
  let match;
  while ((match = hrefRegex.exec(html)) !== null) {
    const href = match[1];
    if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("javascript:")) continue;

    try {
      const resolved = new URL(href, baseUrl).href.split("#")[0];
      if (sameDomain(baseUrl, resolved)) {
        urls.add(resolved);
      }
    } catch {
      // invalid URL, skip
    }
  }

  return Array.from(urls);
}

export async function discoverUrls(domain: string): Promise<string[]> {
  const baseUrl = normalizeUrl(domain);

  // Try sitemap first
  let urls = await trySitemap(baseUrl);

  // Try robots.txt sitemap directives
  if (urls.length === 0) {
    urls = await tryRobotsSitemap(baseUrl);
  }

  // Fallback: scrape homepage links
  if (urls.length === 0) {
    urls = await scrapeHomepageLinks(baseUrl);
  }

  // Deduplicate and cap
  const unique = [...new Set(urls)];
  return unique.slice(0, URL_CAP);
}
