import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { serializeItem } from "@/lib/serialize";
import { StatusBadge } from "@/components/StatusBadge";
import { Thumbnail } from "@/components/Thumbnail";
import { Favicon } from "@/components/Favicon";
import { getSiteUrl, jsonLdString } from "@/lib/site";
import { formatSavedDate } from "@/lib/date";
import { displayHostname } from "@/lib/format";
import { ItemIdSchema } from "@/types/api";

interface PageProps {
  params: { id: string };
}

async function getItem(rawId: string) {
  const id = ItemIdSchema.safeParse(rawId);
  if (!id.success) return null;
  const item = await prisma.item.findUnique({ where: { id: id.data } });
  return item ? serializeItem(item) : null;
}

// Each saved item gets a crawlable, shareable page with its own Open Graph
// tags and JSON-LD, so link previews show the item instead of the app shell.
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const item = await getItem(params.id);
  if (!item) return { title: "Item not found", robots: { index: false } };

  const title = item.title || displayHostname(item.url);
  const description = item.summary || item.description || `Saved from ${displayHostname(item.url)}`;

  return {
    title,
    description,
    keywords: item.tags,
    alternates: { canonical: `/items/${item.id}` },
    openGraph: {
      title,
      description,
      url: `/items/${item.id}`,
      images: item.imageUrl ? [item.imageUrl] : undefined,
      type: "article",
      tags: item.tags,
    },
    twitter: {
      card: item.imageUrl ? "summary_large_image" : "summary",
      title,
      description,
    },
    robots: { index: item.status === "READY" },
  };
}

export default async function ItemDetailPage({ params }: PageProps) {
  const item = await getItem(params.id);
  if (!item) notFound();

  const hostname = displayHostname(item.url);
  const title = item.title || hostname;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description: item.summary || item.description || undefined,
    image: item.imageUrl || undefined,
    url: `${getSiteUrl()}/items/${item.id}`,
    isBasedOn: item.url,
    keywords: item.tags.join(", "),
    dateCreated: item.createdAt,
    dateModified: item.updatedAt,
  };

  return (
    <article className="mx-auto max-w-3xl px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }} />

      <nav aria-label="Breadcrumb">
        <Link href="/" className="btn-ghost -ml-2.5">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to library
        </Link>
      </nav>

      <header className="mt-6">
        <div className="flex flex-wrap items-center gap-2 text-sm text-fg-muted">
          <Favicon src={item.faviconUrl} hostname={hostname} />
          <span className="font-medium">{item.siteName || hostname}</span>
          <span aria-hidden="true">·</span>
          <span>
            Saved <time dateTime={item.createdAt}>{formatSavedDate(item.createdAt)}</time> UTC
          </span>
          <StatusBadge status={item.status} />
        </div>
        <h1 className="mt-3 font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">{title}</h1>
      </header>

      <Thumbnail
        src={item.imageUrl}
        hostname={hostname}
        faviconUrl={item.faviconUrl}
        className="card mt-8 aspect-[16/9] w-full"
      />

      <section aria-labelledby="summary-heading" className="mt-8">
        <h2 id="summary-heading" className="text-xs font-semibold uppercase tracking-wider text-fg-subtle">
          AI summary
        </h2>
        {item.summary ? (
          <p className="mt-3 text-lg leading-relaxed text-fg">{item.summary}</p>
        ) : (
          <p className="mt-3 text-fg-muted">
            {item.description ?? "No summary yet."}
            {item.errorMessage && <span className="mt-2 block text-sm text-fg-subtle">{item.errorMessage}</span>}
          </p>
        )}
      </section>

      {item.tags.length > 0 && (
        <section aria-labelledby="tags-heading" className="mt-8">
          <h2 id="tags-heading" className="text-xs font-semibold uppercase tracking-wider text-fg-subtle">
            Tags
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {item.tags.map((tag) => (
              <li key={tag}>
                <Link
                  href={`/?tags=${encodeURIComponent(tag)}`}
                  className="inline-flex rounded-full border border-line bg-muted/60 px-3 py-1.5 text-sm font-medium text-fg-muted transition-colors hover:border-line-strong hover:text-fg"
                >
                  {tag}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-10 flex flex-wrap items-center gap-3 border-t border-line pt-6">
        <a href={item.url} target="_blank" rel="noopener noreferrer" className="btn-primary">
          Read the original <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </a>
        <span className="min-w-0 truncate text-sm text-fg-subtle">{item.url}</span>
      </div>
    </article>
  );
}
