import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { invalidateItemsCache } from "@/lib/responseCache";
import { Prisma } from "@prisma/client";

/** DELETE /api/items/:id — remove a saved item. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    await prisma.item.delete({ where: { id: params.id } });
    invalidateItemsCache();
    return NextResponse.json({ deleted: true, id: params.id });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2025") {
      return NextResponse.json(
        { error: { message: "Could not delete item", code: "INTERNAL_ERROR" } },
        { status: 500 },
      );
    }
    return NextResponse.json(
      { error: { message: "Item not found", code: "NOT_FOUND" } },
      { status: 404 },
    );
  }
}
