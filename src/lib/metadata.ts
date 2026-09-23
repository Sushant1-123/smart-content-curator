import * as cheerio from "cheerio";
import { lookup } from "node:dns/promises";
import { isSafeExternalUrl, isSafeIpAddress } from "@/lib/url";

export interface PageMetadata {
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  siteName: string | null;
  content: string | null;
}

export class MetadataFetchError extends Error {
  constructor(message: string, public override readonly cause?: unknown) {
    super(message);
    this.name = "MetadataFetchError";
  }
}

const FETCH_TIMEOUT_MS = 8_000;
const MAX_BYTES = 2_000_000;
const MAX_REDIRECTS = 5;
const MAX_ARTICLE_CONTENT_CHARS = 12_000;

export async function fetchPageMetadata(url: string): Promise<PageMetadata> {
  let currentUrl = url;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
      await assertSafeFetchTarget(currentUrl);
      const response = await fetch(currentUrl, {
        signal: controller.signal,
        redirect: "manual",
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; SmartContentCuratorBot/1.0)",
          Accept: "text/html,application/xhtml+xml",
        },
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location || redirectCount === MAX_REDIRECTS) {
          throw new MetadataFetchError("Too many or invalid redirects while fetching page");
        }
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }

      if (!response.ok) {
        throw new MetadataFetchError(`Fetching page returned HTTP ${response.status}`);
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
        html = (await response.text()).slice(0, MAX_BYTES);
      }
      return parseHtmlMetadata(html, currentUrl);
    }
    throw new MetadataFetchError("Too many redirects while fetching page");
  } catch (error) {
    if (error instanceof MetadataFetchError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new MetadataFetchError(`Timed out fetching page after ${FETCH_TIMEOUT_MS}ms`, error);
    }
    throw new MetadataFetchError("Failed to fetch page metadata", error);
  } finally {
    clearTimeout(timeout);
  }
}

async function assertSafeFetchTarget(url: string): Promise<void> {
  if (!isSafeExternalUrl(url)) throw new MetadataFetchError("This URL is not allowed");
  try {
    const addresses = await lookup(new URL(url).hostname, { all: true, verbatim: true });
    if (addresses.length === 0 || addresses.some(({ address }) => !isSafeIpAddress(address))) {
      throw new MetadataFetchError("This URL resolves to a private or internal address");
    }
  } catch (error) {
    if (error instanceof MetadataFetchError) throw error;
    throw new MetadataFetchError("Could not resolve the page host", error);
  }
}

export function parseHtmlMetadata(html: string, pageUrl: string): PageMetadata {
  const $ = cheerio.load(html);
  const meta = (name: string): string | undefined =>
    $(`meta[property="${name}"]`).attr("content")?.trim() ||
    $(`meta[name="${name}"]`).attr("content")?.trim();

  const title = meta("og:title") || meta("twitter:title") || $("title").first().text().trim() || null;
  const description =
    meta("og:description") || meta("twitter:description") || meta("description") || null;

  let imageUrl = meta("og:image") || meta("twitter:image") || null;
  if (imageUrl) {
    try {
      imageUrl = new URL(imageUrl, pageUrl).toString();
    } catch {
      imageUrl = null;
    }
  }

  const siteName = meta("og:site_name") || new URL(pageUrl).hostname || null;

  $("script, style, noscript, nav, aside, footer, header, form, iframe, svg, .ad, .advertisement, .promo, [role='navigation']").remove();

  const contentRoot = $("article").first().length ? $("article").first() : $("main").first().length ? $("main").first() : $("body").first();
  const content = contentRoot
    .find("p, li, h1, h2, h3, h4, blockquote")
    .map((_index, element) => $(element).text())
    .get()
    .join(" \n ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_ARTICLE_CONTENT_CHARS) || null;

  return { title, description, imageUrl, siteName, content };
}
