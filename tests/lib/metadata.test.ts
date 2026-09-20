import { describe, it, expect } from "vitest";
import { parseHtmlMetadata } from "@/lib/metadata";

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
});
