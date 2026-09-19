import { prisma } from "@/lib/prisma";
import { serializeItem } from "@/lib/serialize";
import { ItemsBoard } from "@/components/ItemsBoard";
import { getSiteUrl, SITE_NAME, SITE_DESCRIPTION } from "@/lib/site";

// Rendered per-request so a fresh save shows up immediately on reload
// (acceptance criteria: reload -> previously saved items are still there).
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [items, tagRows] = await Promise.all([
    prisma.item.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.item.findMany({ select: { tags: true } }),
  ]);

  const availableTags = Array.from(new Set(tagRows.flatMap((r) => r.tags))).sort();
  const dtoItems = items.map(serializeItem);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: getSiteUrl(),
    numberOfItems: dtoItems.length,
    itemListElement: dtoItems.slice(0, 20).map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `${getSiteUrl()}/items/${item.id}`,
      name: item.title || item.url,
    })),
  };

  return (
    <>
      {/* Structured data for the saved-items list, so search engines can
          understand this page is a curated collection, not just a form. */}
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <section aria-labelledby="page-heading">
        <div className="mx-auto max-w-5xl px-4 pt-8">
          <h1 id="page-heading" className="text-2xl font-bold tracking-tight text-slate-900">
            Your saved items
          </h1>
          <p className="mt-1 text-sm text-slate-500">{SITE_DESCRIPTION}</p>
        </div>
        <ItemsBoard initialItems={dtoItems} initialTags={availableTags} />
      </section>
    </>
  );
}
