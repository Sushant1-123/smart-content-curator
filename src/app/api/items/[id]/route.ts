import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { invalidateItemsCache } from "@/lib/responseCache";

/** DELETE /api/items/:id — remove a saved item. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    await prisma.item.delete({ where: { id: params.id } });
    invalidateItemsCache();
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json(
      { error: { message: "Item not found", code: "NOT_FOUND" } },
      { status: 404 },
    );
  }
}
