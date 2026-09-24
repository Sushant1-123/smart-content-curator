import type { Item } from "@prisma/client";
import type { ItemDto } from "@/types/api";

/** Maps a Prisma row to the wire-format DTO (Dates -> ISO strings, etc). */
export function serializeItem(item: Item): ItemDto {
  return {
    id: item.id,
    url: item.url,
    title: item.title,
    description: item.description,
    imageUrl: item.imageUrl,
    siteName: item.siteName,
    faviconUrl: item.faviconUrl,
    summary: item.summary,
    tags: item.tags,
    status: item.status,
    errorMessage: item.errorMessage,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}
