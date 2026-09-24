import { describe, it, expect } from "vitest";
import { ApiErrorSchema, CreateItemRequestSchema, ItemIdSchema, ListItemsQuerySchema } from "@/types/api";

describe("CreateItemRequestSchema", () => {
  it("accepts a valid https URL", () => {
    expect(CreateItemRequestSchema.safeParse({ url: "https://example.com" }).success).toBe(true);
  });

  it("rejects an empty string", () => {
    expect(CreateItemRequestSchema.safeParse({ url: "" }).success).toBe(false);
  });

  it("rejects a non-URL string", () => {
    expect(CreateItemRequestSchema.safeParse({ url: "not a url" }).success).toBe(false);
  });

  it("rejects absurdly long URLs", () => {
    expect(CreateItemRequestSchema.safeParse({ url: `https://example.com/${"a".repeat(3000)}` }).success).toBe(false);
  });
});

describe("ListItemsQuerySchema", () => {
  it("defaults every filter when omitted", () => {
    expect(ListItemsQuerySchema.parse({})).toEqual({ q: "", tags: [], sort: "newest", page: 1, limit: 15 });
  });

  it("parses comma-separated tags, lowercased and deduplicated", () => {
    const result = ListItemsQuerySchema.parse({ q: " react ", tags: "Frontend, react,frontend", sort: "oldest" });
    expect(result).toMatchObject({ q: "react", tags: ["frontend", "react"], sort: "oldest" });
  });

  it("rejects malformed tags and unknown sort orders", () => {
    expect(ListItemsQuerySchema.safeParse({ tags: "bad tag!" }).success).toBe(false);
    expect(ListItemsQuerySchema.safeParse({ sort: "random" }).success).toBe(false);
  });

  it("caps the number of combined tags", () => {
    const tags = Array.from({ length: 11 }, (_, i) => `t${i}`).join(",");
    expect(ListItemsQuerySchema.safeParse({ tags }).success).toBe(false);
  });
});

describe("ItemIdSchema", () => {
  it("accepts cuid-style ids and rejects path tricks", () => {
    expect(ItemIdSchema.safeParse("cmueikq7100005obld3e393mr").success).toBe(true);
    expect(ItemIdSchema.safeParse("../etc").success).toBe(false);
  });
});

describe("ApiErrorSchema", () => {
  it("only allows known error codes", () => {
    expect(ApiErrorSchema.safeParse({ error: { message: "x", code: "NOT_FOUND" } }).success).toBe(true);
    expect(ApiErrorSchema.safeParse({ error: { message: "x", code: "WHATEVER" } }).success).toBe(false);
  });
});
