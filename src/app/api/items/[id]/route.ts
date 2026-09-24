import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { invalidateItemsCache } from "@/lib/responseCache";
import { serializeItem } from "@/lib/serialize";
import { internalError, notFound, validationError } from "@/lib/http";
import { ItemIdSchema, type DeleteItemResponse, type RetryItemResponse } from "@/types/api";

interface RouteContext {
  params: { id: string };
}

/** GET /api/items/:id — a single saved item. */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const id = ItemIdSchema.safeParse(params.id);
  if (!id.success) return validationError(id.error);

  const item = await prisma.item.findUnique({ where: { id: id.data } });
  if (!item) return notFound();
  const body: RetryItemResponse = { item: serializeItem(item) };
  return NextResponse.json(body, { headers: { "Cache-Control": "private, no-cache" } });
}

/**
 * DELETE /api/items/:id — remove a saved item. The URL's cached metadata and
 * AI output are kept, so re-saving the same link later costs nothing.
 */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const id = ItemIdSchema.safeParse(params.id);
  if (!id.success) return validationError(id.error);

  try {
    await prisma.item.delete({ where: { id: id.data } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return notFound();
    }
    console.error("DELETE /api/items/:id failed:", error);
    return internalError("Couldn't delete this item");
  }
  invalidateItemsCache();
  const body: DeleteItemResponse = { deleted: true, id: id.data };
  return NextResponse.json(body);
}
