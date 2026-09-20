import { describe, it, expect } from "vitest";
import { CreateItemRequestSchema, ListItemsQuerySchema } from "@/types/api";

describe("CreateItemRequestSchema", () => {
  it("accepts a valid https URL", () => {
    const result = CreateItemRequestSchema.safeParse({ url: "https://example.com" });
    expect(result.success).toBe(true);
  });

  it("rejects an empty string", () => {
    const result = CreateItemRequestSchema.safeParse({ url: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a non-URL string", () => {
    const result = CreateItemRequestSchema.safeParse({ url: "not a url" });
    expect(result.success).toBe(false);
  });
});

describe("ListItemsQuerySchema", () => {
  it("allows both filters to be omitted", () => {
    const result = ListItemsQuerySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts query and tag together", () => {
    const result = ListItemsQuerySchema.safeParse({ query: "react", tag: "frontend" });
    expect(result.success).toBe(true);
  });
});
