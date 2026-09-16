import { createHash } from "node:crypto";

/**
 * Normalizes a URL so that trivial variants (trailing slash, tracking
 * params, http vs https on the same host, mixed case host) are treated as
 * the same saved item. This directly backs the URL-level cache: two
 * "different" URLs that normalize to the same string are a cache hit.
 */
export function normalizeUrl(rawUrl: string): string {
  const url = new URL(rawUrl);

  url.hostname = url.hostname.toLowerCase();

  // Strip common tracking params so `?utm_source=twitter` doesn't defeat
  // the cache for an otherwise identical link.
  const trackingParams = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "fbclid",
    "gclid",
    "ref",
  ];
  for (const param of trackingParams) {
    url.searchParams.delete(param);
  }

  // Normalize trailing slash on the pathname (but keep root "/").
  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.slice(0, -1);
  }

  url.hash = "";

  return url.toString();
}

export function hashUrl(url: string): string {
  return createHash("sha256").update(url).digest("hex");
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
