import type { Metadata } from "next";
import { Suspense } from "react";
import { AllItemsBoard } from "@/components/AllItemsBoard";
import { CardGridSkeleton, PageShell } from "@/components/PageShell";
import { listItems } from "@/lib/itemQueries";
import { PAGE_SIZE } from "@/lib/pagination";
import { parseListQuery, type PageSearchParams } from "@/lib/searchParams";
import type { ListItemsQuery } from "@/types/api";

export const dynamic = "force-dynamic";

const TITLE = "All saved items";
const DESCRIPTION = "Browse every saved link with its AI summary and tags. Search, filter by tag and sort your whole library.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/items" },
  // Setting openGraph replaces the inherited one, so the generated share image is re-attached.
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/items", type: "website", images: ["/opengraph-image"] },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: ["/opengraph-image"] },
};

export default function AllItemsPage({ searchParams }: { searchParams: PageSearchParams }) {
  const query = parseListQuery(searchParams, PAGE_SIZE);
  return (
    <PageShell title={TITLE} description={`Your whole library, ${PAGE_SIZE} items per page.`}>
      <Suspense fallback={<CardGridSkeleton />}>
        <AllItems query={query} />
      </Suspense>
    </PageShell>
  );
}

async function AllItems({ query }: { query: ListItemsQuery }) {
  const data = await listItems(query);
  return <AllItemsBoard initialData={data} initialParams={query} />;
}
