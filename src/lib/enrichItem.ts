import { prisma } from "@/lib/prisma";
import { fetchPageMetadata, MetadataFetchError } from "@/lib/metadata";
import { generateSummaryAndTags, AiGenerationError } from "@/lib/ai";
import { normalizeUrl, hashUrl } from "@/lib/url";
import { serializeItem } from "@/lib/serialize";
import { invalidateItemsCache } from "@/lib/responseCache";
import type { Item } from "@prisma/client";
import type { ItemDto } from "@/types/api";

export class InvalidUrlError extends Error {}

/**
 * Core write path for POST /api/items.
 *
 * Caching strategy (both external calls this route depends on):
 *  1. URL cache: if we've already saved this normalized URL, return the
 *     existing row untouched — no network call, no AI call, no new row.
 *  2. Downstream of that, page-metadata fetch and AI enrichment each run
 *     at most once per distinct URL for the lifetime of the data, since
 *     the result is persisted rather than recomputed on read.
 */
export async function saveAndEnrichItem(
  rawUrl: string,
): Promise<{ item: ItemDto; cached: boolean }> {
  let normalized: string;
  try {
    normalized = normalizeUrl(rawUrl);
  } catch {
    throw new InvalidUrlError(`"${rawUrl}" is not a valid URL`);
  }

  const urlHash = hashUrl(normalized);

  const existing = await prisma.item.findUnique({ where: { urlHash } });
  if (existing) {
    return { item: serializeItem(existing), cached: true };
  }

  let metadata: Awaited<ReturnType<typeof fetchPageMetadata>>;
  try {
    metadata = await fetchPageMetadata(normalized);
  } catch (error) {
    const message =
      error instanceof MetadataFetchError ? error.message : "Failed to fetch page";
    const failed = await prisma.item.create({
      data: {
        url: normalized,
        urlHash,
        status: "FAILED",
        errorMessage: message,
        tags: [],
      },
    });
    invalidateItemsCache();
    return { item: serializeItem(failed), cached: false };
  }

  let created: Item;
  try {
    const enrichment = await generateSummaryAndTags({
      url: normalized,
      title: metadata.title,
      description: metadata.description,
    });

    created = await prisma.item.create({
      data: {
        url: normalized,
        urlHash,
        title: metadata.title,
        description: metadata.description,
        imageUrl: metadata.imageUrl,
        siteName: metadata.siteName,
        summary: enrichment.summary,
        tags: enrichment.tags,
        status: "READY",
      },
    });
  } catch (error) {
    // Metadata succeeded but AI enrichment failed: we still save the item
    // (it has real value — title/image/link) rather than losing the user's
    // save, and surface the failure so the UI can offer a retry.
    const message =
      error instanceof AiGenerationError ? error.message : "AI enrichment failed";
    created = await prisma.item.create({
      data: {
        url: normalized,
        urlHash,
        title: metadata.title,
        description: metadata.description,
        imageUrl: metadata.imageUrl,
        siteName: metadata.siteName,
        status: "PARTIAL",
        errorMessage: message,
        tags: [],
      },
    });
  }

  invalidateItemsCache();
  return { item: serializeItem(created), cached: false };
}

/** Used by POST /api/items/[id]/retry to re-attempt AI enrichment only. */
export async function retryEnrichment(id: string): Promise<ItemDto | null> {
  const item = await prisma.item.findUnique({ where: { id } });
  if (!item) return null;

  try {
    const enrichment = await generateSummaryAndTags({
      url: item.url,
      title: item.title,
      description: item.description,
    });
    const updated = await prisma.item.update({
      where: { id },
      data: {
        summary: enrichment.summary,
        tags: enrichment.tags,
        status: "READY",
        errorMessage: null,
      },
    });
    invalidateItemsCache();
    return serializeItem(updated);
  } catch (error) {
    const message =
      error instanceof AiGenerationError ? error.message : "AI enrichment failed";
    const updated = await prisma.item.update({
      where: { id },
      data: { status: "PARTIAL", errorMessage: message },
    });
    invalidateItemsCache();
    return serializeItem(updated);
  }
}
