import { describe, it, expect } from "vitest";
import { normalizeUrl, hashUrl, isHttpUrl, isSafeExternalUrl, isSafeIpAddress } from "@/lib/url";

describe("normalizeUrl", () => {
  it("strips tracking params", () => {
    expect(normalizeUrl("https://example.com/post?utm_source=twitter&id=1")).toBe(
      "https://example.com/post?id=1",
    );
  });

  it("removes trailing slash but keeps root", () => {
    expect(normalizeUrl("https://example.com/post/")).toBe("https://example.com/post");
    expect(normalizeUrl("https://example.com/")).toBe("https://example.com/");
  });

  it("lowercases the hostname", () => {
    expect(normalizeUrl("https://Example.COM/Post")).toBe("https://example.com/Post");
  });

  it("drops the fragment", () => {
    expect(normalizeUrl("https://example.com/post#section-2")).toBe(
      "https://example.com/post",
    );
  });

  it("treats trivially-different URLs as the same normalized value", () => {
    const a = normalizeUrl("https://example.com/post/?utm_source=x#top");
    const b = normalizeUrl("https://EXAMPLE.com/post");
    expect(a).toBe(b);
  });
});

describe("hashUrl", () => {
  it("is deterministic for the same input", () => {
    expect(hashUrl("https://example.com")).toBe(hashUrl("https://example.com"));
  });

  it("differs for different input", () => {
    expect(hashUrl("https://example.com/a")).not.toBe(hashUrl("https://example.com/b"));
  });
});

describe("isHttpUrl", () => {
  it("accepts http(s) URLs", () => {
    expect(isHttpUrl("https://example.com")).toBe(true);
    expect(isHttpUrl("http://example.com")).toBe(true);
  });

  it("rejects non-http protocols and garbage", () => {
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpUrl("not a url")).toBe(false);
  });
});

describe("SSRF protection", () => {
  it("rejects local and private destinations", () => {
    expect(isSafeExternalUrl("http://localhost:3000")).toBe(false);
    expect(isSafeExternalUrl("http://127.0.0.1")).toBe(false);
    expect(isSafeExternalUrl("http://192.168.1.10")).toBe(false);
    expect(isSafeExternalUrl("http://169.254.169.254/latest/meta-data")).toBe(false);
    expect(isSafeIpAddress("::1")).toBe(false);
  });

  it("allows a public HTTP(S) destination", () => {
    expect(isSafeExternalUrl("https://example.com/article")).toBe(true);
    expect(isSafeExternalUrl("javascript:alert(1)")).toBe(false);
  });
});
