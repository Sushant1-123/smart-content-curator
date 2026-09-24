import { createHash } from "node:crypto";
import type { ListItemsQuery, ListItemsResponse } from "@/types/api";

/**
 * Two layers of caching for GET /api/items (the "own API responses" half of
 * the caching requirement):
 *
 * 1. Server memo: responses are memoized per filter combination for a short
 *    TTL and cleared eagerly on every write (see enrichItem.ts / DELETE), so
 *    repeated reads skip the DB without ever serving stale data from this
 *    instance.
 * 2. HTTP revalidation: every response carries a strong ETag. Clients send
 *    `If-None-Match` and get a body-less 304 when nothing changed.
 *
 * In-memory is deliberate for a single-region app: on serverless each warm
 * instance has its own memo, and the 15s TTL bounds cross-instance
 * staleness. Swapping in Redis would only touch this file.
 */

const TTL_MS = 15_000;

export interface CachedListResponse {
  body: ListItemsResponse;
  etag: string;
}

interface CacheEntry extends CachedListResponse {
  expiresAt: number;
}

const store = new Map<string, CacheEntry>();

export function getCachedItemsResponse(key: string): CachedListResponse | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry;
}

export function setCachedItemsResponse(key: string, body: ListItemsResponse): CachedListResponse {
  const entry = { body, etag: computeEtag(body), expiresAt: Date.now() + TTL_MS };
  store.set(key, entry);
  return entry;
}

export function invalidateItemsCache(): void {
  store.clear();
}

export function buildItemsCacheKey(query: ListItemsQuery): string {
  return JSON.stringify([query.q.toLowerCase(), [...query.tags].sort(), query.sort]);
}

export function computeEtag(body: unknown): string {
  return `"${createHash("sha1").update(JSON.stringify(body)).digest("base64url")}"`;
}

/** Does an `If-None-Match` header match this ETag (handles lists and weak tags)? */
export function etagMatches(ifNoneMatch: string | null, etag: string): boolean {
  if (!ifNoneMatch) return false;
  return ifNoneMatch.split(",").some((tag) => {
    const value = tag.trim();
    return value === "*" || value.replace(/^W\//, "") === etag;
  });
}
