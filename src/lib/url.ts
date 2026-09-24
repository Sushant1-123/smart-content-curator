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
    "utm_id",
    "fbclid",
    "gclid",
    "msclkid",
    "yclid",
    "igshid",
    "mc_cid",
    "mc_eid",
    "_hsenc",
    "_hsmi",
    "ref",
    "ref_src",
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

/**
 * Rejects URLs that could target the local machine, a private network or a
 * cloud metadata service. Hostnames are re-checked after DNS resolution in
 * lib/metadata.ts, so this is the cheap first gate, not the only one.
 */
export function isSafeExternalUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (!isHttpUrl(value) || url.username || url.password || !url.hostname) return false;

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    (!hostname.includes(".") && isIP(hostname) === 0) // single-label intranet names
  ) {
    return false;
  }

  return isIP(hostname) === 0 || isSafeIpAddress(hostname);
}

/** True only for publicly routable IPv4/IPv6 addresses. */
export function isSafeIpAddress(address: string): boolean {
  const normalized = address.toLowerCase().replace(/^\[|\]$/g, "");
  const version = isIP(normalized);

  if (version === 4) return isPublicIpv4(normalized);
  if (version !== 6) return false;

  // IPv4-mapped IPv6 (::ffff:10.0.0.1) inherits the IPv4 verdict.
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped?.[1]) return isPublicIpv4(mapped[1]);

  return !(
    normalized === "::1" ||
    normalized === "::" ||
    normalized.startsWith("::ffff:") || // hex-form mapped addresses
    /^f[cd]/.test(normalized) || // fc00::/7 unique local
    /^fe[89ab]/.test(normalized) // fe80::/10 link-local
  );
}

function isPublicIpv4(address: string): boolean {
  const [a = -1, b = -1] = address.split(".").map(Number);
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224 // multicast + reserved
  );
}

