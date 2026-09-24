import { NextRequest, NextResponse } from "next/server";
import { retryEnrichment, RegenerateFailedError } from "@/lib/enrichItem";
import { checkPostRateLimit, getClientKey } from "@/lib/rateLimit";
import { errorResponse, internalError, notFound, validationError } from "@/lib/http";
import { ItemIdSchema, type RetryItemResponse } from "@/types/api";

/**
 * POST /api/items/:id/retry
 *
 * FAILED  → re-fetch the page, then summarize.
 * PARTIAL → re-run only the AI step (page metadata comes from the cache).
 * READY   → regenerate the summary/tags with a fresh AI call; on failure the
 *           existing summary is kept and a 502 is returned.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const id = ItemIdSchema.safeParse(params.id);
  if (!id.success) return validationError(id.error);

  const rateLimit = checkPostRateLimit(getClientKey(request));
  if (!rateLimit.allowed) {
    return errorResponse(429, "RATE_LIMITED", "Too many requests. Please wait a moment.", {
      "Retry-After": String(rateLimit.retryAfterSeconds),
    });
  }

  try {
    const item = await retryEnrichment(id.data);
    if (!item) return notFound();
    const body: RetryItemResponse = { item };
    return NextResponse.json(body);
  } catch (error) {
    if (error instanceof RegenerateFailedError) {
      return errorResponse(502, "UPSTREAM_ERROR", `Couldn't regenerate the summary. ${error.message}`);
    }
    console.error("POST /api/items/:id/retry failed:", error);
    return internalError("Couldn't retry this item");
  }
}
