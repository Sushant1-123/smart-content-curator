import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { serializeItem } from "@/lib/serialize";
import type { ListItemsQuery, ListItemsResponse, TagCount } from "@/types/api";

const MAX_RESULTS = 500;
const MAX_TERMS = 8;

/** Escapes LIKE wildcards so a search for "100%" matches literally. */
function likePattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/**
 * Library listing shared by GET /api/items and the server-rendered home
 * page, so both always agree on filtering semantics.
 *
 * - Keyword: split on whitespace; every term must appear (case-insensitive)
 *   in the title, summary, site name, URL or any tag.
 * - Tags: the item must carry all selected tags (`tags @> ARRAY[...]`,
 *   served by the GIN index on "tags").
 *
 * Filtering is a raw SQL query because Prisma can't express a partial match
 * inside a text[] column; the matching rows are then loaded through Prisma
 * so the result stays fully typed.
 */
export async function listItems(query: ListItemsQuery): Promise<ListItemsResponse> {
  const terms = query.q.split(/\s+/).filter(Boolean).slice(0, MAX_TERMS);

  const conditions: Prisma.Sql[] = terms.map((term) => {
    const pattern = likePattern(term);
    return Prisma.sql`(
      "title" ILIKE ${pattern} OR "summary" ILIKE ${pattern} OR "siteName" ILIKE ${pattern}
      OR "url" ILIKE ${pattern} OR array_to_string("tags", ' ') ILIKE ${pattern}
    )`;
  });
  if (query.tags.length > 0) conditions.push(Prisma.sql`"tags" @> ${query.tags}::text[]`);

  const where = conditions.length ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}` : Prisma.empty;
  const direction = query.sort === "oldest" ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  const orderBy = { createdAt: query.sort === "oldest" ? "asc" : "desc" } as const;

  const [items, tags, total] = await Promise.all([
    conditions.length === 0
      ? prisma.item.findMany({ orderBy, take: MAX_RESULTS })
      : prisma
          .$queryRaw<{ id: string }[]>`SELECT "id" FROM "Item" ${where} ORDER BY "createdAt" ${direction} LIMIT ${MAX_RESULTS}`
          .then((rows) =>
            prisma.item.findMany({ where: { id: { in: rows.map((r) => r.id) } }, orderBy }),
          ),
    getTagCounts(),
    prisma.item.count(),
  ]);

  return { items: items.map(serializeItem), tags, total };
}

export async function getTagCounts(): Promise<TagCount[]> {
  return prisma.$queryRaw<TagCount[]>`
    SELECT tag AS "name", COUNT(*)::int AS "count"
    FROM "Item", unnest("tags") AS tag
    GROUP BY tag
    ORDER BY "count" DESC, tag ASC`;
}
