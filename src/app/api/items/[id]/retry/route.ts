import { NextRequest, NextResponse } from "next/server";
import { retryEnrichment, RetryNotAllowedError } from "@/lib/enrichItem";

/**
 * POST /api/items/:id/retry
 *
 * Re-attempts AI enrichment for an item stuck in PARTIAL status (metadata
 * saved, but the AI call failed). Kept separate from the create route so a
 * flaky AI call never means re-fetching page metadata or losing the item.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  let item;
  try {
    item = await retryEnrichment(params.id);
  } catch (error) {
    if (error instanceof RetryNotAllowedError) {
      return NextResponse.json(
        { error: { message: error.message, code: "RETRY_NOT_ALLOWED" } },
        { status: 400 },
      );
    }
    console.error("POST /api/items/:id/retry failed:", error);
    return NextResponse.json(
      { error: { message: "Could not retry enrichment", code: "INTERNAL_ERROR" } },
      { status: 500 },
    );
  }
  if (!item) {
    return NextResponse.json(
      { error: { message: "Item not found", code: "NOT_FOUND" } },
      { status: 404 },
    );
  }
  return NextResponse.json({ item });
}
