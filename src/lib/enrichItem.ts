import { prisma } from "@/lib/prisma";
import { fetchPageMetadata, MetadataFetchError } from "@/lib/metadata";
import { generateSummaryAndTags, AiGenerationError } from "@/lib/ai";
import { normalizeUrl, hashUrl, isSafeExternalUrl } from "@/lib/url";
import { serializeItem } from "@/lib/serialize";
import { invalidateItemsCache } from "@/lib/responseCache";
import type { Item } from "@prisma/client";
import type { ItemDto } from "@/types/api";

export class InvalidUrlError extends Error {}
export class RetryNotAllowedError extends Error {}

function shouldRefreshExistingItem(item: Item): boolean {
  if (item.status !== "READY") return true;
  if (!item.summary) return true;

  const wordCount = item.summary.trim().split(/\s+/).filter(Boolean).length;
  const tagCount = item.tags.length;
  return wordCount < 80 || tagCount < 4;
}

/**
 * Core write path for POST /api/items.
 *
 * Caching strategy (both external calls this route depends on):
 *  1. URL cache: if we've already saved this normalized URL and the stored
 *     summary still meets the current enrichment quality bar, return the
 *     existing row untouched — no network call, no AI call, no new row.
 *  2. When the saved item is stale or partial, we refresh it in place using
 *     fresh metadata + the current prompt so old short summaries are not
 *     permanently frozen by the URL cache.
 */
export async function saveAndEnrichItem(
  rawUrl: string,
): Promise<{ item: ItemDto; cached: boolean }> {
  let normalized: string;
  try {
    normalized = normalizeUrl(rawUrl);
    if (!isSafeExternalUrl(normalized)) throw new InvalidUrlError("This URL is not allowed");
  } catch {
    throw new InvalidUrlError(`"${rawUrl}" is not a valid URL`);
  }

  const urlHash = hashUrl(normalized);

  const existing = await prisma.item.findUnique({ where: { urlHash } });
  if (existing) {
    if (!shouldRefreshExistingItem(existing)) {
      return { item: serializeItem(existing), cached: true };
    }

    let metadata: Awaited<ReturnType<typeof fetchPageMetadata>>;
    try {
      metadata = await fetchPageMetadata(normalized);
    } catch (error) {
      const message =
        error instanceof MetadataFetchError ? error.message : "Failed to fetch page";
      const updated = await prisma.item.update({
        where: { id: existing.id },
        data: {
          status: "FAILED",
          errorMessage: message,
        },
      });
      invalidateItemsCache();
      return { item: serializeItem(updated), cached: false };
    }

    try {
      const enrichment = await generateSummaryAndTags({
        url: normalized,
        title: metadata.title ?? existing.title,
        description: metadata.description ?? existing.description,
        content: metadata.content,
      });

      const updated = await prisma.item.update({
        where: { id: existing.id },
        data: {
          title: metadata.title ?? existing.title,
          description: metadata.description ?? existing.description,
          imageUrl: metadata.imageUrl ?? existing.imageUrl,
          siteName: metadata.siteName ?? existing.siteName,
          summary: enrichment.summary,
          tags: enrichment.tags,
          status: "READY",
          errorMessage: null,
        },
      });
      invalidateItemsCache();
      return { item: serializeItem(updated), cached: false };
    } catch (error) {
      const message =
        error instanceof AiGenerationError ? error.message : "AI enrichment failed";
      const updated = await prisma.item.update({
        where: { id: existing.id },
        data: {
          title: metadata.title ?? existing.title,
          description: metadata.description ?? existing.description,
          imageUrl: metadata.imageUrl ?? existing.imageUrl,
          siteName: metadata.siteName ?? existing.siteName,
          status: "PARTIAL",
          errorMessage: message,
        },
      });
      invalidateItemsCache();
      return { item: serializeItem(updated), cached: false };
    }
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
      content: metadata.content,
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
  if (item.status !== "PARTIAL") throw new RetryNotAllowedError("Only partially enriched items can be retried");

  let metadata: Awaited<ReturnType<typeof fetchPageMetadata>>;
  try {
    metadata = await fetchPageMetadata(item.url);
  } catch (error) {
    const message =
      error instanceof MetadataFetchError ? error.message : "Failed to fetch page";
    const updated = await prisma.item.update({
      where: { id },
      data: { status: "FAILED", errorMessage: message },
    });
    invalidateItemsCache();
    return serializeItem(updated);
  }

  try {
    const enrichment = await generateSummaryAndTags({
      url: item.url,
      title: metadata.title ?? item.title,
      description: metadata.description ?? item.description,
      content: metadata.content,
    });
    const updated = await prisma.item.update({
      where: { id },
      data: {
        title: metadata.title ?? item.title,
        description: metadata.description ?? item.description,
        imageUrl: metadata.imageUrl ?? item.imageUrl,
        siteName: metadata.siteName ?? item.siteName,
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
