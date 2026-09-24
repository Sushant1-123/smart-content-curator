import * as cheerio from "cheerio";
import { lookup } from "node:dns/promises";
import { isSafeExternalUrl, isSafeIpAddress } from "@/lib/url";

export interface PageMetadata {
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  siteName: string | null;
  faviconUrl: string | null;
  /** Readable text extracted for the LLM; null for non-HTML resources. */
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
const MAX_FIELD_CHARS = 500;

const HTTP_ERROR_HINTS: Record<number, string> = {
  401: "the page requires a login",
  403: "the site blocked automated access",
  404: "the page was not found",
  410: "the page no longer exists",
  429: "the site is rate-limiting requests",
};

/**
 * Fetches a public web page and extracts display metadata plus readable text.
 *
 * - Every hop (initial URL + each redirect) is re-validated against SSRF
 *   rules *after* DNS resolution, so a redirect to 127.0.0.1 is rejected.
 * - One AbortController covers connect + redirects + body read.
 * - Bodies are capped at MAX_BYTES and decoded with the declared charset.
 * - Non-HTML resources (PDFs, images, …) are saved with URL-derived metadata
 *   instead of being rejected.
 */
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
          "User-Agent":
            "Mozilla/5.0 (compatible; SmartContentCuratorBot/1.0; +https://github.com/)",
          Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
          "Accept-Language": "en;q=0.9,*;q=0.5",
        },
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) throw new MetadataFetchError("The page redirected without a destination");
        if (redirectCount === MAX_REDIRECTS) throw new MetadataFetchError("Too many redirects");
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }

      if (!response.ok) {
        const hint = HTTP_ERROR_HINTS[response.status];
        throw new MetadataFetchError(
          `Couldn't fetch the page (HTTP ${response.status}${hint ? `: ${hint}` : ""})`,
        );
      }

      const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
      const isHtml = contentType.includes("text/html") || contentType.includes("xhtml");
      if (!isHtml) {
        await response.body?.cancel().catch(() => undefined);
        return metadataFromUrl(currentUrl);
      }

      const bytes = await readCapped(response);
      const html = decodeHtml(bytes, contentType);
      return parseHtmlMetadata(html, currentUrl);
    }
    throw new MetadataFetchError("Too many redirects");
  } catch (error) {
    if (error instanceof MetadataFetchError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new MetadataFetchError(`The page took longer than ${FETCH_TIMEOUT_MS / 1000}s to respond`, error);
    }
    throw new MetadataFetchError("Couldn't connect to the page", error);
  } finally {
    clearTimeout(timeout);
  }
}

async function assertSafeFetchTarget(url: string): Promise<void> {
  if (!isSafeExternalUrl(url)) throw new MetadataFetchError("This URL is not allowed");
  let addresses: { address: string }[];
  try {
    addresses = await lookup(new URL(url).hostname, { all: true, verbatim: true });
  } catch (error) {
    throw new MetadataFetchError("Couldn't resolve the site's domain name", error);
  }
  if (addresses.length === 0 || addresses.some(({ address }) => !isSafeIpAddress(address))) {
    throw new MetadataFetchError("This URL resolves to a private or internal address");
  }
}

async function readCapped(response: Response): Promise<Uint8Array> {
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array(await response.arrayBuffer()).slice(0, MAX_BYTES);

  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.byteLength;
  }
  await reader.cancel().catch(() => undefined);

  const out = new Uint8Array(Math.min(total, MAX_BYTES));
  let offset = 0;
  for (const chunk of chunks) {
    const slice = chunk.subarray(0, out.length - offset);
    out.set(slice, offset);
    offset += slice.length;
    if (offset >= out.length) break;
  }
  return out;
}

/** Decodes with the header charset, else a `<meta charset>` in the first 2KB, else UTF-8. */
export function decodeHtml(bytes: Uint8Array, contentType: string): string {
  const fromHeader = contentType.match(/charset=["']?([\w-]+)/i)?.[1];
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 2048));
  const fromMeta =
    head.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1] ??
    head.match(/<meta[^>]+content=["'][^"']*charset=([\w-]+)/i)?.[1];

  for (const label of [fromHeader, fromMeta, "utf-8"]) {
    if (!label) continue;
    try {
      return new TextDecoder(label).decode(bytes);
    } catch {
      // Unknown label — try the next candidate.
    }
  }
  return new TextDecoder().decode(bytes);
}

/** Metadata for resources we can't parse (PDFs, images): derived from the URL. */
export function metadataFromUrl(pageUrl: string): PageMetadata {
  const url = new URL(pageUrl);
  return {
    title: titleFromPath(url.pathname),
    description: null,
    imageUrl: null,
    siteName: url.hostname.replace(/^www\./, ""),
    faviconUrl: `${url.origin}/favicon.ico`,
    content: null,
  };
}

function titleFromPath(pathname: string): string | null {
  const last = decodeURIComponent(pathname.split("/").filter(Boolean).pop() ?? "");
  const words = last
    .replace(/\.[a-z0-9]{1,5}$/i, "")
    .replace(/[-_+]+/g, " ")
    .trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : null;
}

function clean(value: string | undefined | null, max = MAX_FIELD_CHARS): string | null {
  const text = value?.replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : null;
}

function absoluteHttpUrl(value: string | undefined | null, base: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim(), base);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function parseHtmlMetadata(html: string, pageUrl: string): PageMetadata {
  const $ = cheerio.load(html);
  const meta = (name: string): string | undefined =>
    $(`meta[property="${name}"]`).attr("content")?.trim() ||
    $(`meta[name="${name}"]`).attr("content")?.trim() ||
    undefined;
  const url = new URL(pageUrl);

  const title =
    clean(meta("og:title")) ??
    clean(meta("twitter:title")) ??
    clean($("title").first().text()) ??
    clean($("h1").first().text()) ??
    titleFromPath(url.pathname);

  const description = clean(
    meta("og:description") ?? meta("twitter:description") ?? meta("description"),
    1_000,
  );

  const imageUrl = absoluteHttpUrl(
    meta("og:image") ??
      meta("og:image:url") ??
      meta("twitter:image") ??
      meta("twitter:image:src") ??
      $('link[rel="image_src"]').attr("href") ??
      $('meta[itemprop="image"]').attr("content"),
    pageUrl,
  );

  const siteName = clean(meta("og:site_name")) ?? url.hostname.replace(/^www\./, "");

  const iconHref =
    $('link[rel="icon"][sizes="32x32"]').attr("href") ??
    $('link[rel="icon"]').attr("href") ??
    $('link[rel="shortcut icon"]').attr("href") ??
    $('link[rel="apple-touch-icon"]').attr("href");
  const faviconUrl = absoluteHttpUrl(iconHref, pageUrl) ?? `${url.origin}/favicon.ico`;

  $(
    "script, style, noscript, nav, aside, footer, header, form, iframe, svg, .ad, .advertisement, .promo, [role='navigation']",
  ).remove();

  const article = $("article").first();
  const main = $("main").first();
  const contentRoot = article.length ? article : main.length ? main : $("body").first();
  const content =
    contentRoot
      .find("p, li, h1, h2, h3, h4, blockquote")
      .map((_index, element) => $(element).text())
      .get()
      .join(" \n ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, MAX_ARTICLE_CONTENT_CHARS) || null;

  return { title, description, imageUrl, siteName, faviconUrl, content };
}
