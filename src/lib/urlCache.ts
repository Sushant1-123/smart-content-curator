import type { UrlCache } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fetchPageMetadata, type PageMetadata } from "@/lib/metadata";
import { generateSummaryAndTags, PROMPT_VERSION, type Enrichment } from "@/lib/ai";

/**
 * Persistent cache for the two paid/slow external calls, keyed by the
 * normalized-URL hash:
 *
 *  - Page metadata: reused for METADATA_TTL_MS, then re-fetched.
 *  - AI summary/tags: reused indefinitely while `promptVersion` matches
 *    PROMPT_VERSION. Changing the prompt invalidates old entries lazily.
 *
 * The cache lives in Postgres (not process memory) so it survives restarts
 * and is shared by every serverless instance.
 */

const METADATA_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface CacheOptions {
  /** Skip cached values and call the external API again. */
  force?: boolean;
}

export interface CachedResult<T> {
  value: T;
  hit: boolean;
}

function isMetadataFresh(entry: UrlCache | null): entry is UrlCache & { metadataFetchedAt: Date } {
  return Boolean(
    entry?.metadataFetchedAt && Date.now() - entry.metadataFetchedAt.getTime() < METADATA_TTL_MS,
  );
}

function toMetadata(entry: UrlCache): PageMetadata {
  return {
    title: entry.title,
    description: entry.description,
    imageUrl: entry.imageUrl,
    siteName: entry.siteName,
    faviconUrl: entry.faviconUrl,
    content: entry.content,
  };
}

export async function getMetadata(
  url: string,
  urlHash: string,
  options: CacheOptions = {},
): Promise<CachedResult<PageMetadata>> {
  if (!options.force) {
    const entry = await prisma.urlCache.findUnique({ where: { urlHash } });
    if (isMetadataFresh(entry)) return { value: toMetadata(entry), hit: true };
  }

  // Throws MetadataFetchError — failures are deliberately not cached, so a
  // temporarily unreachable page can be retried.
  const metadata = await fetchPageMetadata(url);
  const data = { ...metadata, url, metadataFetchedAt: new Date() };
  await prisma.urlCache.upsert({
    where: { urlHash },
    create: { urlHash, ...data },
    update: data,
  });
  return { value: metadata, hit: false };
}

export async function getEnrichment(
  url: string,
  urlHash: string,
  metadata: PageMetadata,
  options: CacheOptions = {},
): Promise<CachedResult<Enrichment>> {
  if (!options.force) {
    const entry = await prisma.urlCache.findUnique({ where: { urlHash } });
    if (entry?.summary && entry.promptVersion === PROMPT_VERSION && entry.tags.length > 0) {
      return {
        value: { summary: entry.summary, tags: entry.tags, model: entry.model ?? "unknown" },
        hit: true,
      };
    }
  }

  // Throws AiGenerationError — not cached, so retry can call the API again.
  const enrichment = await generateSummaryAndTags({
    url,
    title: metadata.title,
    description: metadata.description,
    content: metadata.content,
  });
  const data = {
    summary: enrichment.summary,
    tags: enrichment.tags,
    model: enrichment.model,
    promptVersion: PROMPT_VERSION,
    aiGeneratedAt: new Date(),
  };
  await prisma.urlCache.upsert({
    where: { urlHash },
    create: { urlHash, url, ...data },
    update: data,
  });
  return { value: enrichment, hit: false };
}
