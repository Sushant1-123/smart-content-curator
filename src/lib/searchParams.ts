import { ListItemsQuerySchema, type ListItemsQuery } from "@/types/api";

export type PageSearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Reads `?q=&tags=&sort=&page=` for a server-rendered page with the same
 * schema as GET /api/items. Invalid params fall back to the defaults rather
 * than erroring, since they usually come from a hand-edited URL.
 */
export function parseListQuery(searchParams: PageSearchParams, limit: number): ListItemsQuery {
  const parsed = ListItemsQuerySchema.safeParse({
    q: first(searchParams.q),
    tags: first(searchParams.tags),
    sort: first(searchParams.sort),
    page: first(searchParams.page),
    limit,
  });
  return parsed.success ? parsed.data : ListItemsQuerySchema.parse({ limit });
}
