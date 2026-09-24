/** Pure pagination helpers shared by the list query, the API and the UI. */

/** Items per page on /items and /summaries. */
export const PAGE_SIZE = 15;

/** How many items the home page previews before the "More" card. */
export const HOME_PREVIEW_COUNT = 3;

/** Rows the home page loads: a few spares fill the preview while a delete waits out its undo window. */
export const HOME_FETCH_LIMIT = HOME_PREVIEW_COUNT * 2;

export function getPageCount(total: number, pageSize: number): number {
  if (total <= 0 || pageSize <= 0) return 1;
  return Math.ceil(total / pageSize);
}

export function clampPage(page: number, pageCount: number): number {
  if (!Number.isFinite(page)) return 1;
  return Math.min(Math.max(1, Math.floor(page)), Math.max(1, pageCount));
}

/** Prisma/SQL offset window for a 1-based page. */
export function getSkipTake(page: number, pageSize: number): { skip: number; take: number } {
  return { skip: (Math.max(1, Math.floor(page)) - 1) * pageSize, take: pageSize };
}

export type PageToken = number | "ellipsis";

/**
 * Page buttons to render: always the first and last page, the current page
 * with `siblings` on each side, and "…" where a gap hides two or more pages.
 * A gap of exactly one page shows that page instead of an ellipsis.
 */
export function getPageTokens(current: number, pageCount: number, siblings = 1): PageToken[] {
  if (pageCount <= 1) return [1];
  const page = clampPage(current, pageCount);
  const start = Math.max(2, page - siblings);
  const end = Math.min(pageCount - 1, page + siblings);

  const tokens: PageToken[] = [1];
  if (start > 3) tokens.push("ellipsis");
  else for (let p = 2; p < start; p += 1) tokens.push(p);
  for (let p = start; p <= end; p += 1) tokens.push(p);
  if (end < pageCount - 2) tokens.push("ellipsis");
  else for (let p = end + 1; p < pageCount; p += 1) tokens.push(p);
  tokens.push(pageCount);
  return tokens;
}

/**
 * The page to show for the current filters. A page number is remembered
 * together with the filter key it was chosen under, so changing the search,
 * tags or sort falls back to page 1 without an extra state update.
 */
export function resolvePage(selection: { page: number; filterKey: string }, filterKey: string): number {
  return selection.filterKey === filterKey ? selection.page : 1;
}

/** Stable key for a filter combination (tag order doesn't matter). */
export function buildFilterKey(filters: { q: string; tags: readonly string[]; sort: string }): string {
  return JSON.stringify([filters.q.trim().toLowerCase(), [...filters.tags].sort(), filters.sort]);
}

/**
 * The home page preview: the first `limit` items that aren't hidden by a
 * pending (undoable) delete, leaving room for in-flight save cards so the
 * grid never grows past `limit` because of them.
 */
export function selectHomeItems<T extends { id: string }>(
  items: readonly T[],
  hiddenIds: ReadonlySet<string>,
  pendingCount = 0,
  limit = HOME_PREVIEW_COUNT,
): T[] {
  return items.filter((item) => !hiddenIds.has(item.id)).slice(0, Math.max(0, limit - pendingCount));
}
