import type { ListItemsResponse } from "@/types/api";

/**
 * Lightweight in-process cache for GET /api/items.
 *
 * This is the "your own API responses" half of the caching requirement:
 * the list endpoint is read far more often than items are written, so we
 * memoize responses per distinct (query, tag) filter combination for a
 * short TTL, and invalidate everything eagerly whenever an item is
 * created/updated (see enrichItem.ts).
 *
 * Deliberately in-memory rather than Redis: this is a small single-region
 * app, and Next.js route handlers on most serverless hosts (Vercel) run
 * with a warm module scope per instance, which is enough to meaningfully
 * cut duplicate DB round-trips without adding infra. A note on scaling
 * this to multi-instance/Redis is in the README.
 */

const TTL_MS = 15_000;

interface CacheEntry {
  value: ListItemsResponse;
  expiresAt: number;
}

const store = new Map<string, CacheEntry>();

export function getCachedItemsResponse(key: string): ListItemsResponse | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

export function setCachedItemsResponse(key: string, value: ListItemsResponse): void {
  store.set(key, { value, expiresAt: Date.now() + TTL_MS });
}

export function invalidateItemsCache(): void {
  store.clear();
}

export function buildItemsCacheKey(query: string | undefined, tag: string | undefined): string {
  return `q=${(query ?? "").toLowerCase()}|t=${(tag ?? "").toLowerCase()}`;
}
