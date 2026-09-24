import type { Metadata } from "next";
import { Suspense } from "react";
import { SummariesBoard } from "@/components/SummariesBoard";
import { PageShell, SummaryListSkeleton } from "@/components/PageShell";
import { listItems } from "@/lib/itemQueries";
import { PAGE_SIZE } from "@/lib/pagination";
import { parseListQuery, type PageSearchParams } from "@/lib/searchParams";
import type { ListItemsQuery } from "@/types/api";

export const dynamic = "force-dynamic";

const TITLE = "Saved summaries";
const DESCRIPTION = "Read the AI-written summary of every saved link in one place, newest first, with tags and a link to each original post.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/summaries" },
  // Setting openGraph replaces the inherited one, so the generated share image is re-attached.
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/summaries", type: "website", images: ["/opengraph-image"] },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: ["/opengraph-image"] },
};

export default function SummariesPage({ searchParams }: { searchParams: PageSearchParams }) {
  // A reading view: search and page only, always newest first.
  const query: ListItemsQuery = { ...parseListQuery(searchParams, PAGE_SIZE), tags: [], sort: "newest" };
  return (
    <PageShell title={TITLE} description="Every AI summary in your library, newest first." narrow>
      <Suspense fallback={<SummaryListSkeleton />}>
        <Summaries query={query} />
      </Suspense>
    </PageShell>
  );
}

async function Summaries({ query }: { query: ListItemsQuery }) {
  const data = await listItems(query);
  return <SummariesBoard initialData={data} initialParams={query} />;
}
