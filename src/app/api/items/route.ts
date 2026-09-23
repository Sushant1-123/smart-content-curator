import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeItem } from "@/lib/serialize";
import { saveAndEnrichItem, InvalidUrlError } from "@/lib/enrichItem";
import {
  CreateItemRequestSchema,
  ListItemsQuerySchema,
  type ListItemsResponse,
} from "@/types/api";
import {
  buildItemsCacheKey,
  getCachedItemsResponse,
  setCachedItemsResponse,
} from "@/lib/responseCache";
import type { Prisma } from "@prisma/client";
import { checkPostRateLimit, getClientKey } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/**
 * GET /api/items?query=&tag=
 *
 * Returns the saved-items list, optionally narrowed by a free-text keyword
 * (matched against title/summary/site name) and/or an exact tag. Also
 * returns the full set of distinct tags currently in use, so the frontend
 * can render a tag filter without a separate round trip.
 */
export async function GET(request: NextRequest) {
  const parsedQuery = ListItemsQuerySchema.safeParse({
    query: request.nextUrl.searchParams.get("query") ?? undefined,
    tag: request.nextUrl.searchParams.get("tag") ?? undefined,
  });

  if (!parsedQuery.success) {
    return NextResponse.json(
      { error: { message: "Invalid query parameters", code: "INVALID_QUERY" } },
      { status: 400 },
    );
  }

  const { query, tag } = parsedQuery.data;
  const cacheKey = buildItemsCacheKey(query, tag);
  const cached = getCachedItemsResponse(cacheKey);
  if (cached) {
    return NextResponse.json(cached, {
      headers: { "X-Cache": "HIT", "Cache-Control": "private, max-age=5" },
    });
  }

  const where: Prisma.ItemWhereInput = {};
  if (query) {
    where.OR = [
      { title: { contains: query, mode: "insensitive" } },
      { summary: { contains: query, mode: "insensitive" } },
      { siteName: { contains: query, mode: "insensitive" } },
      { url: { contains: query, mode: "insensitive" } },
    ];
  }
  if (tag) {
    where.tags = { has: tag.toLowerCase() };
  }

  const [items, tagRows] = await Promise.all([
    prisma.item.findMany({ where, orderBy: { createdAt: "desc" } }),
    // Distinct tags across ALL items (not just the filtered set) so the
    // filter control doesn't shrink as the user narrows results.
    prisma.item.findMany({ select: { tags: true } }),
  ]);

  const availableTags = Array.from(new Set(tagRows.flatMap((r) => r.tags))).sort();

  const body: ListItemsResponse = {
    items: items.map(serializeItem),
    availableTags,
  };

  setCachedItemsResponse(cacheKey, body);

  return NextResponse.json(body, {
    headers: { "X-Cache": "MISS", "Cache-Control": "private, max-age=5" },
  });
}

/**
 * POST /api/items  { url: string }
 *
 * Fetches page metadata, generates a summary + tags via the Gemini API,
 * and persists the result. Returns the existing row (cached: true) if this
 * URL was already saved, instead of re-doing either external call.
 */
export async function POST(request: NextRequest) {
  const rateLimit = checkPostRateLimit(getClientKey(request));
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: { message: "Too many submissions. Please try again later.", code: "RATE_LIMITED" } },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { message: "Request body must be valid JSON", code: "INVALID_JSON" } },
      { status: 400 },
    );
  }

  const parsed = CreateItemRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          message: parsed.error.errors[0]?.message ?? "Invalid request",
          code: "VALIDATION_ERROR",
        },
      },
      { status: 400 },
    );
  }

  try {
    const { item, cached } = await saveAndEnrichItem(parsed.data.url);
    return NextResponse.json({ item, cached }, { status: cached ? 200 : 201 });
  } catch (error) {
    if (error instanceof InvalidUrlError) {
      return NextResponse.json(
        { error: { message: error.message, code: "INVALID_URL" } },
        { status: 400 },
      );
    }
    console.error("POST /api/items failed:", error);
    return NextResponse.json(
      {
        error: {
          message: "Something went wrong saving this item. Please try again.",
          code: "INTERNAL_ERROR",
        },
      },
      { status: 500 },
    );
  }
}
