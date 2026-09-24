import { Prisma, type Item } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { MetadataFetchError, metadataFromUrl, type PageMetadata } from "@/lib/metadata";
import { AiGenerationError } from "@/lib/ai";
import { getEnrichment, getMetadata } from "@/lib/urlCache";
import { normalizeUrl, hashUrl, isSafeExternalUrl } from "@/lib/url";
import { serializeItem } from "@/lib/serialize";
import { invalidateItemsCache } from "@/lib/responseCache";
import type { ItemDto } from "@/types/api";

export class InvalidUrlError extends Error {}

/** Thrown when regenerating a READY item fails; the item itself is left untouched. */
export class RegenerateFailedError extends Error {}

type EnrichedFields = Pick<
  Prisma.ItemUncheckedCreateInput,
  "title" | "description" | "imageUrl" | "siteName" | "faviconUrl" | "summary" | "tags" | "status" | "errorMessage"
>;

interface PipelineOptions {
  forceMetadata?: boolean;
  forceAi?: boolean;
}

function metadataFields(metadata: PageMetadata) {
  return {
    title: metadata.title,
    description: metadata.description,
    imageUrl: metadata.imageUrl,
    siteName: metadata.siteName,
    faviconUrl: metadata.faviconUrl,
  };
}

/**
 * metadata (cached) → AI summary/tags (cached) → fields for the Item row.
 * Expected failures become a status + message instead of an exception, so
 * the user's save is never lost: FAILED = page unreachable, PARTIAL = page
 * fetched but the AI step failed. Both are retryable. Anything else
 * (e.g. the DB being down) propagates as a real error.
 */
async function runPipeline(url: string, urlHash: string, options: PipelineOptions = {}): Promise<EnrichedFields> {
  let metadata: PageMetadata;
  try {
    ({ value: metadata } = await getMetadata(url, urlHash, { force: options.forceMetadata }));
  } catch (error) {
    if (!(error instanceof MetadataFetchError)) throw error;
    return {
      ...metadataFields(metadataFromUrl(url)),
      summary: null,
      tags: [],
      status: "FAILED",
      errorMessage: error.message,
    };
  }

  try {
    const { value: enrichment } = await getEnrichment(url, urlHash, metadata, { force: options.forceAi });
    return {
      ...metadataFields(metadata),
      summary: enrichment.summary,
      tags: enrichment.tags,
      status: "READY",
      errorMessage: null,
    };
  } catch (error) {
    if (!(error instanceof AiGenerationError)) throw error;
    return {
      ...metadataFields(metadata),
      summary: null,
      tags: [],
      status: "PARTIAL",
      errorMessage: error.message,
    };
  }
}

// Concurrent saves of the same URL (double-click, two tabs) share one
// pipeline run instead of racing to call the external APIs twice.
const inFlight = new Map<string, Promise<{ item: ItemDto; cached: boolean }>>();

/**
 * Core write path for POST /api/items.
 *
 * Duplicate handling: URLs are normalized (tracking params, trailing slash,
 * host case, fragment) and hashed. A URL that's already saved and READY is
 * returned as-is (`cached: true`) with zero external calls. Re-submitting a
 * FAILED/PARTIAL item acts as a retry.
 */
export async function saveAndEnrichItem(rawUrl: string): Promise<{ item: ItemDto; cached: boolean }> {
  let normalized: string;
  try {
    normalized = normalizeUrl(rawUrl);
  } catch {
    throw new InvalidUrlError("Enter a valid http(s) URL");
  }
  if (!isSafeExternalUrl(normalized)) {
    throw new InvalidUrlError("Only public web pages can be saved");
  }

  const urlHash = hashUrl(normalized);
  const existing = await prisma.item.findUnique({ where: { urlHash } });
  if (existing?.status === "READY") return { item: serializeItem(existing), cached: true };

  const pending = inFlight.get(urlHash);
  if (pending) return pending;

  const run = (async () => {
    if (existing) {
      const fields = await runPipeline(normalized, urlHash, { forceMetadata: existing.status === "FAILED" });
      const updated = await prisma.item.update({ where: { id: existing.id }, data: fields });
      return { item: serializeItem(updated), cached: false };
    }

    const fields = await runPipeline(normalized, urlHash);
    try {
      const created = await prisma.item.create({ data: { url: normalized, urlHash, ...fields } });
      return { item: serializeItem(created), cached: false };
    } catch (error) {
      // Another instance saved the same URL between our lookup and insert.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const winner = await prisma.item.findUniqueOrThrow({ where: { urlHash } });
        return { item: serializeItem(winner), cached: true };
      }
      throw error;
    }
  })().finally(() => {
    inFlight.delete(urlHash);
    invalidateItemsCache();
  });

  inFlight.set(urlHash, run);
  return run;
}

/**
 * POST /api/items/:id/retry.
 *  - FAILED  → re-fetch the page (bypassing the metadata cache), then AI.
 *  - PARTIAL → reuse cached metadata, call the AI again.
 *  - READY   → "regenerate": force a fresh AI call. If it fails, the
 *              existing summary is kept and RegenerateFailedError is thrown.
 */
export async function retryEnrichment(id: string): Promise<ItemDto | null> {
  const item = await prisma.item.findUnique({ where: { id } });
  if (!item) return null;

  const regenerate = item.status === "READY";
  const fields = await runPipeline(item.url, item.urlHash, {
    forceMetadata: item.status === "FAILED",
    forceAi: regenerate,
  });

  if (regenerate && fields.status !== "READY") {
    throw new RegenerateFailedError(fields.errorMessage ?? "Couldn't regenerate the summary");
  }

  const updated: Item = await prisma.item.update({ where: { id }, data: fields });
  invalidateItemsCache();
  return serializeItem(updated);
}
