import { createHash } from "node:crypto";
import { isIP } from "node:net";

/**
 * Normalizes a URL so that trivial variants (trailing slash, tracking
 * params, http vs https on the same host, mixed case host) are treated as
 * the same saved item. This directly backs the URL-level cache: two
 * "different" URLs that normalize to the same string are a cache hit.
 */
export function normalizeUrl(rawUrl: string): string {
  const url = new URL(rawUrl);
  if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password) {
    throw new Error("Only public HTTP(S) URLs are supported");
  }

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

/** Reject URLs that could target the local machine or cloud metadata services. */
export function isSafeExternalUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (!isHttpUrl(value) || url.username || url.password || !url.hostname) return false;

    const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname === "local") {
      return false;
    }

    const numericAddress = isIP(hostname);
    if (!numericAddress) return true;

    if (numericAddress === 4) {
      const octets = hostname.split(".").map(Number);
      const first = octets[0] ?? -1;
      const second = octets[1] ?? -1;
      return isSafeIpAddress(hostname) && !(
        first === 0 ||
        first === 10 ||
        first === 127 ||
        (first === 169 && second === 254) ||
        (first === 172 && second >= 16 && second <= 31) ||
        (first === 192 && second === 168) ||
        (first === 100 && second >= 64 && second <= 127)
      );
    }

    const normalized = hostname.toLowerCase();
    return !(
      normalized === "::1" ||
      normalized === "::" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe8") ||
      normalized.startsWith("fe9") ||
      normalized.startsWith("fea") ||
      normalized.startsWith("feb") ||
      normalized.startsWith("::ffff:10.") ||
      normalized.startsWith("::ffff:127.") ||
      normalized.startsWith("::ffff:192.168.") ||
      normalized.startsWith("::ffff:169.254.")
    );
  } catch {
    return false;
  }
}
export function isSafeIpAddress(address: string): boolean {
  const normalized = address.toLowerCase().replace(/^\[|\]$/g, "");
  const numericAddress = isIP(normalized);
  if (numericAddress === 4) {
    const octets = normalized.split(".").map(Number);
    const first = octets[0] ?? -1;
    const second = octets[1] ?? -1;
    return !(
      first === 0 ||
      first === 10 ||
      first === 127 ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168) ||
      (first === 100 && second >= 64 && second <= 127)
    );
  }
  if (numericAddress !== 6) return false;

  return !(
    normalized === "::1" ||
    normalized === "::" ||
    normalized.startsWith("::ffff:192.168.") ||
    normalized.startsWith("::ffff:169.254.")
  );
}
