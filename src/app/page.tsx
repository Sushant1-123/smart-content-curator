import { ItemsBoard } from "@/components/ItemsBoard";
import { listItems } from "@/lib/itemQueries";
import { getSiteUrl, jsonLdString, SITE_NAME, SITE_DESCRIPTION } from "@/lib/site";
import { HOME_FETCH_LIMIT } from "@/lib/pagination";
import { parseListQuery, type PageSearchParams } from "@/lib/searchParams";

// Rendered per request so a reload always reflects the database.
export const dynamic = "force-dynamic";

export default async function HomePage({ searchParams }: { searchParams: PageSearchParams }) {
  // The home page is a preview: always the first rows, whatever ?page= says.
  const query = { ...parseListQuery(searchParams, HOME_FETCH_LIMIT), page: 1 };
  const data = await listItems(query);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: getSiteUrl(),
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: data.total,
      itemListElement: data.items.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: `${getSiteUrl()}/items/${item.id}`,
        name: item.title || item.url,
      })),
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }} />
      <div className="relative isolate">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(60%_100%_at_50%_0%,rgb(var(--accent)/0.12),transparent)]"
        />
        <div className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6 sm:pt-16">
          <header className="mx-auto mb-8 max-w-2xl text-center">
            <h1 className="font-display text-4xl font-semibold tracking-tight text-fg sm:text-5xl">
              Read smarter, <span className="text-accent">not longer</span>
            </h1>
            <p className="mt-4 text-base text-fg-muted sm:text-lg">
              Save any link. AI writes a short summary and tags it by topic, so your reading list stays easy to search.
            </p>
          </header>
          <ItemsBoard
            initialData={data}
            initialParams={query}
          />
        </div>
      </div>
    </>
  );
}
