import { describe, it, expect } from "vitest";
import { decodeHtml, metadataFromUrl, parseHtmlMetadata } from "@/lib/metadata";

describe("parseHtmlMetadata", () => {
  it("prefers Open Graph tags when present", () => {
    const html = `
      <html><head>
        <title>Fallback Title</title>
        <meta name="description" content="fallback description" />
        <meta property="og:title" content="OG Title" />
        <meta property="og:description" content="OG description" />
        <meta property="og:image" content="/img.png" />
        <meta property="og:site_name" content="Example Site" />
      </head></html>`;

    const result = parseHtmlMetadata(html, "https://example.com/post");

    expect(result.title).toBe("OG Title");
    expect(result.description).toBe("OG description");
    expect(result.imageUrl).toBe("https://example.com/img.png");
    expect(result.siteName).toBe("Example Site");
  });

  it("falls back to <title> and meta description when OG tags are absent", () => {
    const html = `
      <html><head>
        <title>Plain Title</title>
        <meta name="description" content="plain description" />
      </head></html>`;

    const result = parseHtmlMetadata(html, "https://example.com/post");

    expect(result.title).toBe("Plain Title");
    expect(result.description).toBe("plain description");
    expect(result.imageUrl).toBeNull();
    expect(result.siteName).toBe("example.com");
  });

  it("resolves relative image URLs against the page URL", () => {
    const html = `<html><head><meta property="og:image" content="images/cover.jpg" /></head></html>`;
    const result = parseHtmlMetadata(html, "https://example.com/blog/post");
    expect(result.imageUrl).toBe("https://example.com/blog/images/cover.jpg");
  });

  it("extracts readable article content while removing boilerplate", () => {
    const html = `
      <html>
        <head>
          <title>Example Title</title>
          <meta name="description" content="Example description" />
        </head>
        <body>
          <nav>Menu</nav>
          <main>
            <article>
              <h1>What the new report says</h1>
              <p>First paragraph explains the central finding and why it matters.</p>
              <p>Second paragraph describes the implementation timeline and early reactions.</p>
            </article>
          </main>
          <script>const hidden = "not part of summary";</script>
          <style>.x { color: red; }</style>
        </body>
      </html>
    `;

    const result = parseHtmlMetadata(html, "https://example.com/post");

    expect(result.title).toBe("Example Title");
    expect(result.description).toBe("Example description");
    expect(result.content).toContain("central finding");
    expect(result.content).toContain("implementation timeline");
    expect(result.content).not.toContain("Menu");
    expect(result.content).not.toContain("not part of summary");
  });
});

describe("metadata fallbacks", () => {
  it("falls back to <h1>, then the URL slug, when there is no <title>", () => {
    expect(parseHtmlMetadata("<html><body><h1>Heading Title</h1></body></html>", "https://example.com/x").title).toBe(
      "Heading Title",
    );
    expect(parseHtmlMetadata("<html></html>", "https://example.com/blog/my-first-post").title).toBe("My first post");
  });

  it("extracts the favicon, defaulting to /favicon.ico", () => {
    const withIcon = parseHtmlMetadata(`<link rel="icon" href="/static/icon.png">`, "https://example.com/a");
    expect(withIcon.faviconUrl).toBe("https://example.com/static/icon.png");
    expect(parseHtmlMetadata("<html></html>", "https://www.example.com/a").faviconUrl).toBe(
      "https://www.example.com/favicon.ico",
    );
  });

  it("ignores non-http image URLs", () => {
    const html = `<meta property="og:image" content="javascript:alert(1)">`;
    expect(parseHtmlMetadata(html, "https://example.com").imageUrl).toBeNull();
  });

  it("derives metadata for non-HTML resources from the URL", () => {
    expect(metadataFromUrl("https://www.example.com/papers/attention_is_all_you_need.pdf", "application/pdf")).toEqual({
      title: "Attention is all you need",
      description: "PDF document hosted on example.com",
      imageUrl: null,
      siteName: "example.com",
      faviconUrl: "https://www.example.com/favicon.ico",
      content: null,
    });
  });
});

describe("titleFromPath edge cases", () => {
  it("keeps dotted identifiers and survives malformed escapes", () => {
    expect(metadataFromUrl("https://arxiv.org/pdf/1706.03762").title).toBe("1706.03762");
    expect(metadataFromUrl("https://example.com/bad%E0%A4%A").title).toBe("Bad%E0%A4%A");
  });
});

describe("decodeHtml", () => {
  it("honours the charset from the Content-Type header", () => {
    const latin1 = new Uint8Array([0x63, 0x61, 0x66, 0xe9]); // "café" in ISO-8859-1
    expect(decodeHtml(latin1, "text/html; charset=iso-8859-1")).toBe("café");
  });

  it("falls back to a <meta charset> declaration, then UTF-8", () => {
    const bytes = new Uint8Array([...new TextEncoder().encode("<meta charset=\"windows-1252\">"), 0xe9]);
    expect(decodeHtml(bytes, "text/html")).toContain("é");
    expect(decodeHtml(new TextEncoder().encode("naïve"), "text/html")).toBe("naïve");
  });
});
