export interface CheckPageOptions {
  url: string;
  etag?: string | null;
  lastModified?: string | null;
}

export interface CheckPageResult {
  changed: boolean;
  etag: string | null;
  lastModified: string | null;
  error?: string;
}

/**
 * Sends a conditional HTTP request to detect whether a page has changed
 * without doing a full Puppeteer extraction. Uses ETag/Last-Modified
 * headers when available — returns { changed: false } on 304 Not Modified.
 *
 * If no cached headers are available (first run or server doesn't support them),
 * always returns { changed: true } so the caller proceeds with full extraction.
 */
export async function checkPage({
  url,
  etag,
  lastModified,
}: CheckPageOptions): Promise<CheckPageResult> {
  const headers: Record<string, string> = {
    "User-Agent": "Envoyer/1.0 (knowledge-base crawler)",
  };

  if (etag) headers["If-None-Match"] = etag;
  if (lastModified) headers["If-Modified-Since"] = lastModified;

  const hasConditionalHeaders = !!(etag || lastModified);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(15_000),
    });

    const responseEtag = response.headers.get("etag");
    const responseLastModified = response.headers.get("last-modified");

    if (response.status === 304) {
      return {
        changed: false,
        etag: responseEtag ?? etag ?? null,
        lastModified: responseLastModified ?? lastModified ?? null,
      };
    }

    if (!response.ok) {
      return {
        changed: true,
        etag: null,
        lastModified: null,
        error: `HTTP ${response.status}`,
      };
    }

    // If we had no conditional headers, we can't distinguish "changed" from
    // "first check" — always return changed so the caller does full extraction.
    // If we did have headers and got 200 instead of 304, content has changed.
    return {
      changed: true,
      etag: responseEtag,
      lastModified: responseLastModified,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown fetch error";
    return {
      changed: !hasConditionalHeaders,
      etag: null,
      lastModified: null,
      error: message,
    };
  }
}
