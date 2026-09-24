import { NextRequest, NextResponse } from "next/server";
import { saveAndEnrichItem, InvalidUrlError } from "@/lib/enrichItem";
import { listItems } from "@/lib/itemQueries";
import {
  CreateItemRequestSchema,
  ListItemsQuerySchema,
  type CreateItemResponse,
} from "@/types/api";
import {
  buildItemsCacheKey,
  etagMatches,
  getCachedItemsResponse,
  setCachedItemsResponse,
} from "@/lib/responseCache";
import { checkPostRateLimit, getClientKey } from "@/lib/rateLimit";
import { errorResponse, internalError, validationError } from "@/lib/http";

export const dynamic = "force-dynamic";
// Page fetch (≤8s) + Gemini with retries can exceed the default serverless timeout.
export const maxDuration = 60;

// Browsers/CDNs must revalidate every time (cheap 304 via ETag), and the
// list is per-library data, so it's never stored in shared caches.
const LIST_CACHE_CONTROL = "private, no-cache";

/**
 * GET /api/items?q=&tags=a,b&sort=newest|oldest&page=1&limit=15
 *
 * Lists one page of saved items, narrowed by keyword (title/summary/site/
 * URL/tags) and/or tags (AND), plus the matching count and tag counts for
 * the whole library.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const parsed = ListItemsQuerySchema.safeParse({
    q: params.get("q") ?? undefined,
    tags: params.get("tags") ?? undefined,
    sort: params.get("sort") ?? undefined,
    page: params.get("page") ?? undefined,
    limit: params.get("limit") ?? undefined,
  });
  if (!parsed.success) return validationError(parsed.error);

  const cacheKey = buildItemsCacheKey(parsed.data);
  let entry = getCachedItemsResponse(cacheKey);
  const cacheStatus = entry ? "HIT" : "MISS";
  if (!entry) {
    try {
      entry = setCachedItemsResponse(cacheKey, await listItems(parsed.data));
    } catch (error) {
      console.error("GET /api/items failed:", error);
      return internalError("Couldn't load your saved items");
    }
  }

  const headers = { ETag: entry.etag, "Cache-Control": LIST_CACHE_CONTROL, "X-Cache": cacheStatus };
  if (etagMatches(request.headers.get("if-none-match"), entry.etag)) {
    return new NextResponse(null, { status: 304, headers });
  }
  return NextResponse.json(entry.body, { headers });
}

/**
 * POST /api/items  { url }
 *
 * Fetches page metadata, generates a summary + tags with Gemini and saves
 * the item. 201 for a new item; 200 with `cached: true` when the URL was
 * already saved (no external calls made).
 */
export async function POST(request: NextRequest) {
  const rateLimit = checkPostRateLimit(getClientKey(request));
  if (!rateLimit.allowed) {
    return errorResponse(429, "RATE_LIMITED", "Too many saves in a short time. Please wait a moment.", {
      "Retry-After": String(rateLimit.retryAfterSeconds),
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON");
  }

  const parsed = CreateItemRequestSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const result: CreateItemResponse = await saveAndEnrichItem(parsed.data.url);
    return NextResponse.json(result, { status: result.cached ? 200 : 201 });
  } catch (error) {
    if (error instanceof InvalidUrlError) return errorResponse(400, "INVALID_URL", error.message);
    console.error("POST /api/items failed:", error);
    return internalError("Something went wrong saving this link. Please try again.");
  }
}
