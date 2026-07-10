import { fetchViaUnblocker, isUnblockerEnabled } from "./unblock";

const BROWSER_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

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

export function isStaticAsset(url: string): boolean {
  try {
    const path = new URL(url).pathname;
    return STATIC_ASSET_PATTERN.test(path);
  } catch {
    return false;
  }
}

// Paths that are never useful for a support knowledge base
const NEGATIVE_PATTERNS = [
  /\/products\//i,
  /\/collections\//i,
  /\/cart(\/|$)/i,
  /\/checkout(\/|$)/i,
  /\/account(\/|$)/i,
  /\/search(\/|$)/i,
  /\/tags\//i,
  /\/blogs\/.*\/tagged\//i,
];

export function isNegativeFiltered(url: string): boolean {
  try {
    const path = new URL(url).pathname;
    return NEGATIVE_PATTERNS.some((p) => p.test(path));
  } catch {
    return false;
  }
}

// --- Locale detection and dedup ---

// Matches locale prefixes like /en, /en-AU, /fr-CA, /de-DE
const LOCALE_PREFIX_REGEX = /^\/([a-z]{2}(?:-[A-Z]{2})?)(\/|$)/;

export interface LocaleInfo {
  locales: string[];
  defaultLocale: string;
}

/** Detect locale prefixes from a set of URLs. Returns null if no locales found. */
export function detectLocales(urls: string[]): LocaleInfo | null {
  const localeCounts = new Map<string, number>();

  for (const url of urls) {
    try {
      const path = new URL(url).pathname;
      const match = path.match(LOCALE_PREFIX_REGEX);
      if (match) {
        const locale = match[1];
        localeCounts.set(locale, (localeCounts.get(locale) || 0) + 1);
      }
    } catch {
      // skip
    }
  }

  // Only treat as locale-based if we found at least 2 distinct locales
  // and they cover a meaningful portion of the URLs
  if (localeCounts.size < 2) return null;

  const totalLocaleUrls = [...localeCounts.values()].reduce((a, b) => a + b, 0);
  if (totalLocaleUrls < urls.length * 0.3) return null;

  // Default locale = the one with the most URLs
  const sorted = [...localeCounts.entries()].sort((a, b) => b[1] - a[1]);
  return {
    locales: sorted.map(([locale]) => locale),
    defaultLocale: sorted[0][0],
  };
}

/** Strip locale prefix from a URL path to get the canonical content path */
function stripLocalePrefix(pathname: string): string {
  return pathname.replace(LOCALE_PREFIX_REGEX, "/");
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
      headers: { "User-Agent": BROWSER_UA },
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

// A pluggable text fetcher. Defaults to plain `fetchText`, but the sitemap
// signals can be re-run through the Browserbase unblocker on bot-blocked sites.
type Fetcher = (url: string) => Promise<string | null>;

async function resolveSitemapXml(
  xml: string,
  fetcher: Fetcher = fetchText
): Promise<string[]> {
  let urls = parseSitemapUrls(xml);

  if (isSitemapIndex(urls)) {
    const children = prioritizeChildSitemaps(urls).slice(0, 10);
    // Fetch children in parallel — bounds latency when each fetch is a
    // round-trip through the unblocker.
    const childXmls = await Promise.all(children.map((c) => fetcher(c)));

    const childUrls: string[] = [];
    const grandchildren: string[] = [];
    for (const childXml of childXmls) {
      if (!childXml) continue;
      const parsed = parseSitemapUrls(childXml);
      if (isSitemapIndex(parsed)) {
        grandchildren.push(...prioritizeChildSitemaps(parsed).slice(0, 5));
      } else {
        childUrls.push(...parsed);
      }
    }

    if (grandchildren.length > 0) {
      const gcXmls = await Promise.all(grandchildren.map((g) => fetcher(g)));
      for (const gcXml of gcXmls) {
        if (gcXml) childUrls.push(...parseSitemapUrls(gcXml));
      }
    }

    urls = childUrls;
  }

  return urls;
}

// --- Discovery signals (run in parallel) ---

async function fromSitemap(
  baseUrl: string,
  fetcher: Fetcher = fetchText
): Promise<string[]> {
  const xml = await fetcher(`${baseUrl}/sitemap.xml`);
  if (!xml) return [];
  const urls = await resolveSitemapXml(xml, fetcher);
  return urls.filter((u) => sameDomain(baseUrl, u));
}

async function fromRobotsSitemap(
  baseUrl: string,
  fetcher: Fetcher = fetchText
): Promise<string[]> {
  const robots = await fetcher(`${baseUrl}/robots.txt`);
  if (!robots) return [];

  const sitemapUrls: string[] = [];
  for (const line of robots.split("\n")) {
    const match = line.match(/^Sitemap:\s*(.+)/i);
    if (match) sitemapUrls.push(match[1].trim());
  }

  const resolved = await Promise.all(
    sitemapUrls.slice(0, 3).map(async (sitemapUrl) => {
      const xml = await fetcher(sitemapUrl);
      return xml ? resolveSitemapXml(xml, fetcher) : [];
    })
  );

  return resolved.flat().filter((u) => sameDomain(baseUrl, u));
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
        headers: { "User-Agent": BROWSER_UA },
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
        headers: { "User-Agent": BROWSER_UA },
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

// --- Bot-protection detection ---

export type BlockReason = "cloudflare" | "bot-protection";

interface BlockInfo {
  reason: BlockReason;
  evidence: string;
}

/**
 * Classify a response as a bot-protection block. A 403/429/503 from Cloudflare
 * (identified by the `server`/`cf-ray`/`cf-mitigated` headers) is the case we
 * care about — the plain-fetch tier can't clear it, so the caller should route
 * to the browser/unblocker path rather than report "no pages found".
 */
function classifyBlock(res: Response): BlockInfo | null {
  const blockedStatus =
    res.status === 403 || res.status === 429 || res.status === 503;
  if (!blockedStatus) return null;

  const server = res.headers.get("server")?.toLowerCase() ?? "";
  const isCloudflare =
    server.includes("cloudflare") ||
    res.headers.has("cf-ray") ||
    res.headers.has("cf-mitigated");

  return isCloudflare
    ? { reason: "cloudflare", evidence: `HTTP ${res.status} (cloudflare)` }
    : { reason: "bot-protection", evidence: `HTTP ${res.status}` };
}

/**
 * Cheaply probe a URL for a bot-protection block. Uses HEAD (no body) and falls
 * back to GET for servers that reject HEAD. Returns null on network errors —
 * those are not a definitive block signal.
 */
async function probeBlock(url: string): Promise<BlockInfo | null> {
  try {
    let res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": BROWSER_UA },
    });
    if (res.status === 405 || res.status === 501) {
      res = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: AbortSignal.timeout(8000),
        headers: { "User-Agent": BROWSER_UA },
      });
    }
    res.body?.cancel().catch(() => {});
    return classifyBlock(res);
  } catch {
    return null;
  }
}

// --- Main discovery ---

export type DiscoverOutcome =
  | { status: "ok"; urls: string[]; localeInfo: LocaleInfo | null }
  | { status: "blocked"; reason: BlockReason; evidence: string }
  | { status: "empty" };

/** Order URLs support-relevant first and build an `ok` outcome. */
function toOkOutcome(urls: string[]): DiscoverOutcome {
  const support: string[] = [];
  const rest: string[] = [];
  for (const url of urls) {
    if (isSupportRelevant(url)) support.push(url);
    else rest.push(url);
  }
  return {
    status: "ok",
    urls: [...support, ...rest],
    localeInfo: detectLocales(urls),
  };
}

/**
 * Tier 2: re-run the sitemap-based signals through the Browserbase unblocker.
 * Only the sitemap/robots signals are retried — they're the URL-rich sources,
 * and each unblocker call counts against the Browserbase quota. Returns an `ok`
 * outcome if it recovers URLs, or null if disabled or still empty (caller then
 * falls back to the existing browser job).
 */
async function discoverViaUnblocker(
  baseUrl: string
): Promise<DiscoverOutcome | null> {
  if (!isUnblockerEnabled()) return null;

  const [sitemapUrls, robotsUrls] = await Promise.all([
    fromSitemap(baseUrl, fetchViaUnblocker),
    fromRobotsSitemap(baseUrl, fetchViaUnblocker),
  ]);

  const unique = [...new Set([...sitemapUrls, ...robotsUrls])].filter(
    (u) => !isStaticAsset(u) && !isNegativeFiltered(u)
  );
  if (unique.length === 0) return null;

  return toOkOutcome(unique);
}

export async function discoverUrls(domain: string): Promise<DiscoverOutcome> {
  const baseUrl = normalizeUrl(domain);

  // Fast-fail: if the homepage itself is walled off by bot protection, every
  // fetch-based signal below will 403. Detect it up front, then try the
  // unblocker before reporting "blocked".
  const homepageBlock = await probeBlock(baseUrl);
  if (homepageBlock) {
    const viaUnblocker = await discoverViaUnblocker(baseUrl);
    if (viaUnblocker) return viaUnblocker;
    return {
      status: "blocked",
      reason: homepageBlock.reason,
      evidence: homepageBlock.evidence,
    };
  }

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

  // Deduplicate, filter static assets, and apply negative filtering
  const unique = [...new Set(all)].filter(
    (u) => !isStaticAsset(u) && !isNegativeFiltered(u)
  );

  if (unique.length === 0) {
    // Homepage was reachable but yielded nothing. Check whether the sitemap
    // specifically is bot-blocked (homepage-open / sitemap-walled sites) before
    // concluding the site is genuinely empty.
    const sitemapBlock = await probeBlock(`${baseUrl}/sitemap.xml`);
    if (sitemapBlock) {
      const viaUnblocker = await discoverViaUnblocker(baseUrl);
      if (viaUnblocker) return viaUnblocker;
      return {
        status: "blocked",
        reason: sitemapBlock.reason,
        evidence: sitemapBlock.evidence,
      };
    }
    return { status: "empty" };
  }

  return toOkOutcome(unique);
}
