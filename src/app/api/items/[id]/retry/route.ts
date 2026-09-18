import { NextRequest, NextResponse } from "next/server";
import { retryEnrichment } from "@/lib/enrichItem";

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
  const item = await retryEnrichment(params.id);
  if (!item) {
    return NextResponse.json(
      { error: { message: "Item not found", code: "NOT_FOUND" } },
      { status: 404 },
    );
  }
  return NextResponse.json({ item });
}
