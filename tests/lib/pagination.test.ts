import { describe, expect, it } from "vitest";
import {
  HOME_PREVIEW_COUNT,
  PAGE_SIZE,
  buildFilterKey,
  clampPage,
  getPageCount,
  getPageTokens,
  getSkipTake,
  resolvePage,
  selectHomeItems,
} from "@/lib/pagination";
import { buildItemsCacheKey } from "@/lib/responseCache";
import { buildListSearchParams } from "@/lib/apiClient";
import { ListItemsQuerySchema } from "@/types/api";

describe("getPageCount", () => {
  it("rounds up and never returns fewer than one page", () => {
    expect(getPageCount(0, PAGE_SIZE)).toBe(1);
    expect(getPageCount(1, 15)).toBe(1);
    expect(getPageCount(15, 15)).toBe(1);
    expect(getPageCount(16, 15)).toBe(2);
    expect(getPageCount(45, 15)).toBe(3);
    expect(getPageCount(46, 15)).toBe(4);
  });
});

describe("getSkipTake", () => {
  it("maps 1-based pages to offsets", () => {
    expect(getSkipTake(1, 15)).toEqual({ skip: 0, take: 15 });
    expect(getSkipTake(2, 15)).toEqual({ skip: 15, take: 15 });
    expect(getSkipTake(4, 15)).toEqual({ skip: 45, take: 15 });
  });

  it("treats pages below 1 as the first page", () => {
    expect(getSkipTake(0, 15)).toEqual({ skip: 0, take: 15 });
  });
});

describe("clampPage", () => {
  it("keeps the page inside 1..pageCount", () => {
    expect(clampPage(3, 5)).toBe(3);
    expect(clampPage(9, 5)).toBe(5);
    expect(clampPage(0, 5)).toBe(1);
    expect(clampPage(2, 0)).toBe(1);
    expect(clampPage(Number.NaN, 5)).toBe(1);
  });
});

describe("getPageTokens", () => {
  it("lists every page when there are only a few", () => {
    expect(getPageTokens(1, 1)).toEqual([1]);
    expect(getPageTokens(2, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("collapses long runs into an ellipsis on either side", () => {
    expect(getPageTokens(1, 12)).toEqual([1, 2, "ellipsis", 12]);
    expect(getPageTokens(6, 12)).toEqual([1, "ellipsis", 5, 6, 7, "ellipsis", 12]);
    expect(getPageTokens(12, 12)).toEqual([1, "ellipsis", 11, 12]);
  });

  it("shows a single hidden page instead of an ellipsis", () => {
    expect(getPageTokens(4, 12)).toEqual([1, 2, 3, 4, 5, "ellipsis", 12]);
  });
});

describe("page reset on filter change", () => {
  const filters = { q: "react", tags: ["frontend"], sort: "newest" };

  it("keeps the chosen page while the filters are unchanged", () => {
    const selection = { page: 3, filterKey: buildFilterKey(filters) };
    expect(resolvePage(selection, buildFilterKey({ ...filters }))).toBe(3);
    // Tag order and search case/whitespace don't count as a change.
    expect(resolvePage(selection, buildFilterKey({ ...filters, q: " React " }))).toBe(3);
  });

  it("falls back to page 1 when the search, tags or sort change", () => {
    const selection = { page: 3, filterKey: buildFilterKey(filters) };
    expect(resolvePage(selection, buildFilterKey({ ...filters, q: "vue" }))).toBe(1);
    expect(resolvePage(selection, buildFilterKey({ ...filters, tags: ["frontend", "css"] }))).toBe(1);
    expect(resolvePage(selection, buildFilterKey({ ...filters, sort: "oldest" }))).toBe(1);
  });
});

describe("selectHomeItems (home page limit)", () => {
  const items = Array.from({ length: 6 }, (_, i) => ({ id: `item-${i}` }));

  it("shows at most three items", () => {
    expect(HOME_PREVIEW_COUNT).toBe(3);
    expect(selectHomeItems(items, new Set()).map((i) => i.id)).toEqual(["item-0", "item-1", "item-2"]);
    expect(selectHomeItems(items.slice(0, 2), new Set())).toHaveLength(2);
  });

  it("fills the gap left by a delete that is waiting for undo, and restores order on undo", () => {
    const hidden = new Set(["item-1"]);
    expect(selectHomeItems(items, hidden).map((i) => i.id)).toEqual(["item-0", "item-2", "item-3"]);
    expect(selectHomeItems(items, new Set()).map((i) => i.id)).toEqual(["item-0", "item-1", "item-2"]);
  });

  it("makes room for in-flight save cards at the top", () => {
    expect(selectHomeItems(items, new Set(), 1).map((i) => i.id)).toEqual(["item-0", "item-1"]);
    expect(selectHomeItems(items, new Set(), 4)).toEqual([]);
  });
});

describe("paged list query", () => {
  it("parses page and limit from the query string with defaults", () => {
    expect(ListItemsQuerySchema.parse({})).toMatchObject({ page: 1, limit: PAGE_SIZE });
    expect(ListItemsQuerySchema.parse({ page: "3", limit: "3" })).toMatchObject({ page: 3, limit: 3 });
  });

  it("rejects invalid pages and limits", () => {
    expect(ListItemsQuerySchema.safeParse({ page: "0" }).success).toBe(false);
    expect(ListItemsQuerySchema.safeParse({ page: "1.5" }).success).toBe(false);
    expect(ListItemsQuerySchema.safeParse({ limit: "1000" }).success).toBe(false);
  });

  it("gives every page its own cache entry (and so its own ETag)", () => {
    const page1 = ListItemsQuerySchema.parse({ page: "1" });
    const page2 = ListItemsQuerySchema.parse({ page: "2" });
    const smaller = ListItemsQuerySchema.parse({ page: "1", limit: "3" });
    expect(buildItemsCacheKey(page1)).not.toBe(buildItemsCacheKey(page2));
    expect(buildItemsCacheKey(page1)).not.toBe(buildItemsCacheKey(smaller));
  });

  it("puts the page in the URL only after page 1", () => {
    expect(buildListSearchParams({ q: "", tags: [], sort: "newest", page: 1 }).toString()).toBe("");
    expect(buildListSearchParams({ q: "css", tags: ["a", "b"], sort: "oldest", page: 2 }).toString()).toBe(
      "q=css&tags=a%2Cb&sort=oldest&page=2",
    );
  });
});
