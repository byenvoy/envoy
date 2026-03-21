const URL_CAP = 200;

const SUPPORT_PATTERNS =
  /\/(support|faq|help|docs|knowledge|article|guide|tutorial|delivery|returns|shipping|terms|policies|contact|about)/i;

export function isSupportRelevant(url: string): boolean {
  try {
    const path = new URL(url).pathname;
    return SUPPORT_PATTERNS.test(path);
  } catch {
    return false;
  }
}

const STATIC_ASSET_PATTERN =
  /\.(woff2?|ttf|eot|otf|css|js|mjs|png|jpe?g|gif|svg|ico|webp|avif|webmanifest|map|json)(\?.*)?$/i;

function isStaticAsset(url: string): boolean {
  try {
    const path = new URL(url).pathname;
    return STATIC_ASSET_PATTERN.test(path);
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

async function fetchJson(url: string): Promise<unknown | null> {
  const text = await fetchText(url);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// --- Sitemap resolution ---

function parseSitemapUrls(xml: string): string[] {
  const urls: string[] = [];
  const locRegex = /<loc>\s*(.*?)\s*<\/loc>/gi;
  let match;
  while ((match = locRegex.exec(xml)) !== null) {
    urls.push(match[1]);
  }
  return urls;
}

function isSitemapIndex(urls: string[]): boolean {
  return urls.length > 0 && urls.every((u) => u.endsWith(".xml"));
}

const PRODUCT_SITEMAP_PATTERNS = /product|collect/i;
const SUPPORT_SITEMAP_PATTERNS = /page|content|blog|support|help|faq|article|guide|custom/i;

function prioritizeChildSitemaps(urls: string[]): string[] {
  const support: string[] = [];
  const other: string[] = [];
  const product: string[] = [];

  for (const url of urls) {
    const filename = url.split("/").pop() || "";
    if (SUPPORT_SITEMAP_PATTERNS.test(filename)) {
      support.push(url);
    } else if (PRODUCT_SITEMAP_PATTERNS.test(filename)) {
      product.push(url);
    } else {
      other.push(url);
    }
  }

  return [...support, ...other, ...product];
}

async function resolveSitemapXml(xml: string): Promise<string[]> {
  let urls = parseSitemapUrls(xml);

  if (isSitemapIndex(urls)) {
    const childUrls: string[] = [];
    const children = prioritizeChildSitemaps(urls).slice(0, 10);
    for (const childUrl of children) {
      const childXml = await fetchText(childUrl);
      if (childXml) {
        const parsed = parseSitemapUrls(childXml);
        if (isSitemapIndex(parsed)) {
          const grandchildren = prioritizeChildSitemaps(parsed).slice(0, 5);
          for (const grandchild of grandchildren) {
            const gcXml = await fetchText(grandchild);
            if (gcXml) childUrls.push(...parseSitemapUrls(gcXml));
          }
        } else {
          childUrls.push(...parsed);
        }
      }
    }
    urls = childUrls;
  }

  return urls;
}

// --- Discovery signals (run in parallel) ---

async function fromSitemap(baseUrl: string): Promise<string[]> {
  const xml = await fetchText(`${baseUrl}/sitemap.xml`);
  if (!xml) return [];
  const urls = await resolveSitemapXml(xml);
  return urls.filter((u) => sameDomain(baseUrl, u));
}

async function fromRobotsSitemap(baseUrl: string): Promise<string[]> {
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
    if (xml) {
      const resolved = await resolveSitemapXml(xml);
      allUrls.push(...resolved);
    }
  }

  return allUrls.filter((u) => sameDomain(baseUrl, u));
}

async function fromHomepage(baseUrl: string): Promise<string[]> {
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

const COMMON_SUPPORT_PATHS = [
  "/help",
  "/faq",
  "/support",
  "/contact",
  "/pages/faq",
  "/pages/help",
  "/pages/contact",
  "/pages/shipping",
  "/pages/returns",
  "/pages/shipping-policy",
  "/pages/return-policy",
  "/pages/refund-policy",
  "/pages/terms-of-service",
  "/pages/privacy-policy",
  "/pages/about",
  "/policies/shipping-policy",
  "/policies/refund-policy",
  "/policies/privacy-policy",
  "/policies/terms-of-service",
  "/docs",
  "/knowledge-base",
];

async function fromCommonPaths(baseUrl: string): Promise<string[]> {
  const found: string[] = [];

  // Probe all paths concurrently
  const results = await Promise.allSettled(
    COMMON_SUPPORT_PATHS.map(async (path) => {
      const url = `${baseUrl}${path}`;
      const res = await fetch(url, {
        method: "HEAD",
        signal: AbortSignal.timeout(5000),
        headers: { "User-Agent": "Envoyer/1.0 (knowledge-base crawler)" },
        redirect: "follow",
      });
      if (res.ok) return url;
      return null;
    })
  );

  for (const result of results) {
    if (result.status === "fulfilled" && result.value) {
      found.push(result.value);
    }
  }

  return found;
}

async function fromSupportSubdomains(baseUrl: string): Promise<string[]> {
  const host = new URL(baseUrl).hostname;
  // Don't probe subdomains if the domain already is a subdomain like help.example.com
  const parts = host.split(".");
  if (parts.length > 2) return [];

  const baseDomain = parts.slice(-2).join(".");
  const subdomains = ["help", "support", "faq", "docs"];
  const found: string[] = [];

  const results = await Promise.allSettled(
    subdomains.map(async (sub) => {
      const url = `https://${sub}.${baseDomain}`;
      const res = await fetch(url, {
        method: "HEAD",
        signal: AbortSignal.timeout(5000),
        headers: { "User-Agent": "Envoyer/1.0 (knowledge-base crawler)" },
        redirect: "follow",
      });
      if (res.ok) return url;
      return null;
    })
  );

  for (const result of results) {
    if (result.status === "fulfilled" && result.value) {
      found.push(result.value);
    }
  }

  return found;
}

async function fromShopifyPages(baseUrl: string): Promise<string[]> {
  // Detect Shopify by checking for /pages.json
  const data = await fetchJson(`${baseUrl}/pages.json`);
  if (!data || typeof data !== "object" || !("pages" in data)) return [];

  const pages = (data as { pages: { handle: string }[] }).pages;
  return pages.map((p) => `${baseUrl}/pages/${p.handle}`);
}

// --- Main discovery ---

export async function discoverUrls(domain: string): Promise<string[]> {
  const baseUrl = normalizeUrl(domain);

  // Run all discovery signals in parallel
  const [
    sitemapUrls,
    robotsUrls,
    homepageUrls,
    commonPathUrls,
    subdomainUrls,
    shopifyUrls,
  ] = await Promise.all([
    fromSitemap(baseUrl),
    fromRobotsSitemap(baseUrl),
    fromHomepage(baseUrl),
    fromCommonPaths(baseUrl),
    fromSupportSubdomains(baseUrl),
    fromShopifyPages(baseUrl),
  ]);

  // Merge all results
  const all = [
    ...shopifyUrls,
    ...commonPathUrls,
    ...subdomainUrls,
    ...homepageUrls,
    ...sitemapUrls,
    ...robotsUrls,
  ];

  // Deduplicate and filter static assets
  const unique = [...new Set(all)].filter((u) => !isStaticAsset(u));

  // Partition: support-relevant URLs first, then the rest
  const support: string[] = [];
  const rest: string[] = [];
  for (const url of unique) {
    if (isSupportRelevant(url)) {
      support.push(url);
    } else {
      rest.push(url);
    }
  }

  return [...support, ...rest].slice(0, URL_CAP);
}
