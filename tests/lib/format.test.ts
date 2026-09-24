import { describe, expect, it } from "vitest";
import { displayHostname, hueFromString, withProtocol } from "@/lib/format";
import { computeEtag, etagMatches } from "@/lib/responseCache";

describe("withProtocol", () => {
  it("adds https:// to bare domains but leaves explicit schemes alone", () => {
    expect(withProtocol("example.com/post")).toBe("https://example.com/post");
    expect(withProtocol("  http://example.com ")).toBe("http://example.com");
    expect(withProtocol("ftp://example.com")).toBe("ftp://example.com");
  });
});

describe("displayHostname", () => {
  it("drops www. and falls back to the raw value", () => {
    expect(displayHostname("https://www.example.com/a")).toBe("example.com");
    expect(displayHostname("nope")).toBe("nope");
  });
});

describe("hueFromString", () => {
  it("is deterministic and in range", () => {
    expect(hueFromString("example.com")).toBe(hueFromString("example.com"));
    expect(hueFromString("example.com")).toBeGreaterThanOrEqual(0);
    expect(hueFromString("example.com")).toBeLessThan(360);
  });
});

describe("ETag helpers", () => {
  it("produces stable ETags and matches If-None-Match lists and weak tags", () => {
    const etag = computeEtag({ items: [], tags: [], total: 0 });
    expect(etag).toBe(computeEtag({ items: [], tags: [], total: 0 }));
    expect(etagMatches(`"other", W/${etag}`, etag)).toBe(true);
    expect(etagMatches(null, etag)).toBe(false);
    expect(etagMatches('"other"', etag)).toBe(false);
  });
});
