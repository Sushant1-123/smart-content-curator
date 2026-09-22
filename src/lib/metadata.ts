import * as cheerio from "cheerio";

export interface PageMetadata {
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  siteName: string | null;
}

export class MetadataFetchError extends Error {
  constructor(
    message: string,
    public override readonly cause?: unknown,
  ) {
    super(message);
    this.name = "MetadataFetchError";
  }
}

const FETCH_TIMEOUT_MS = 8_000;
const MAX_BYTES = 2_000_000; // don't stream down someone's entire 50MB SPA

/**
 * Fetches a page and extracts Open Graph / Twitter Card / plain <meta>
 * fallbacks. This is the "external API #1" the assignment asks us to cache
 * — see lib/enrichItem.ts for where the cache check happens before this is
 * ever called.
 */
export async function fetchPageMetadata(url: string): Promise<PageMetadata> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        // Some sites block requests with no UA / no accept header.
        "User-Agent":
          "Mozilla/5.0 (compatible; SmartContentCuratorBot/1.0; +https://example.com/bot)",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (!response.ok) {
      throw new MetadataFetchError(
        `Fetching page returned HTTP ${response.status}`,
      );
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      throw new MetadataFetchError(
        `Unsupported content-type for metadata extraction: ${contentType || "unknown"}`,
      );
    }

    const reader = response.body?.getReader();
    let html = "";
    if (reader) {
      let bytesRead = 0;
      const decoder = new TextDecoder();
      while (bytesRead < MAX_BYTES) {
        const { done, value } = await reader.read();
        if (done) break;
        bytesRead += value.byteLength;
        html += decoder.decode(value, { stream: true });
      }
      await reader.cancel().catch(() => undefined);
    } else {
      html = await response.text();
    }

    return parseHtmlMetadata(html, url);
  } catch (error) {
    if (error instanceof MetadataFetchError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new MetadataFetchError(
        `Timed out fetching page after ${FETCH_TIMEOUT_MS}ms`,
        error,
      );
    }
    throw new MetadataFetchError("Failed to fetch page metadata", error);
  } finally {
    clearTimeout(timeout);
  }
}

export function parseHtmlMetadata(html: string, pageUrl: string): PageMetadata {
  const $ = cheerio.load(html);

  const meta = (name: string): string | undefined =>
    $(`meta[property="${name}"]`).attr("content")?.trim() ||
    $(`meta[name="${name}"]`).attr("content")?.trim();

  const title =
    meta("og:title") || meta("twitter:title") || $("title").first().text().trim() || null;

  const description =
    meta("og:description") ||
    meta("twitter:description") ||
    meta("description") ||
    null;

  let imageUrl = meta("og:image") || meta("twitter:image") || null;
  if (imageUrl) {
    try {
      imageUrl = new URL(imageUrl, pageUrl).toString();
    } catch {
      imageUrl = null;
    }
  }

  const siteName = meta("og:site_name") || new URL(pageUrl).hostname || null;

  return {
    title: title || null,
    description: description || null,
    imageUrl,
    siteName,
  };
}
