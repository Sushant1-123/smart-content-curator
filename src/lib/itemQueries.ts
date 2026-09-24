import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { serializeItem } from "@/lib/serialize";
import { clampPage, getPageCount, getSkipTake } from "@/lib/pagination";
import type { ListItemsQuery, ListItemsResponse, TagCount } from "@/types/api";

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
 * - Paging: one page (`LIMIT/OFFSET`) plus the matching-row count, both in
 *   the database, so no request loads more than `limit` items.
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
  const dir = query.sort === "oldest" ? "asc" : "desc";
  // "id" breaks ties between rows saved in the same millisecond, so pages never overlap.
  const orderBy = [{ createdAt: dir }, { id: dir }] as const;

  const loadPage = ({ skip, take }: { skip: number; take: number }) =>
    conditions.length === 0
      ? prisma.item.findMany({ orderBy: [...orderBy], skip, take })
      : prisma
          .$queryRaw<{ id: string }[]>`SELECT "id" FROM "Item" ${where}
            ORDER BY "createdAt" ${direction}, "id" ${direction} LIMIT ${take} OFFSET ${skip}`
          .then((rows) => prisma.item.findMany({ where: { id: { in: rows.map((r) => r.id) } }, orderBy: [...orderBy] }));

  const [firstTry, tags, total, matched] = await Promise.all([
    loadPage(getSkipTake(query.page, query.limit)),
    getTagCounts(),
    prisma.item.count(),
    conditions.length === 0
      ? null // same as `total`
      : prisma.$queryRaw<{ count: number }[]>`SELECT COUNT(*)::int AS "count" FROM "Item" ${where}`.then(
          (rows) => rows[0]?.count ?? 0,
        ),
  ]);

  const matchedCount = matched ?? total;
  const pageCount = getPageCount(matchedCount, query.limit);
  const page = clampPage(query.page, pageCount);
  // Rare: the page ran past the end (e.g. its last item was just deleted), so load the last real page.
  const items = page === query.page ? firstTry : await loadPage(getSkipTake(page, query.limit));

  return {
    items: items.map(serializeItem),
    tags,
    total,
    matched: matchedCount,
    page,
    pageSize: query.limit,
    pageCount,
  };
}

export async function getTagCounts(): Promise<TagCount[]> {
  return prisma.$queryRaw<TagCount[]>`
    SELECT tag AS "name", COUNT(*)::int AS "count"
    FROM "Item", unnest("tags") AS tag
    GROUP BY tag
    ORDER BY "count" DESC, tag ASC`;
}
