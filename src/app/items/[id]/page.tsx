import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { serializeItem } from "@/lib/serialize";
import { StatusBadge } from "@/components/StatusBadge";
import { TagPill } from "@/components/TagPill";
import { getSiteUrl } from "@/lib/site";

interface PageProps {
  params: { id: string };
}

async function getItem(id: string) {
  const item = await prisma.item.findUnique({ where: { id } });
  return item ? serializeItem(item) : null;
}

// Each saved item gets its own real, crawlable, shareable page with
// per-item Open Graph tags and JSON-LD — a creative SEO addition beyond
// the base single-page requirement: link previews (Slack, X, iMessage)
// render the actual page's title/image/summary instead of the app shell.
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const item = await getItem(params.id);
  if (!item) return { title: "Item not found" };

  const description = item.summary || item.description || `Saved from ${item.url}`;

  return {
    title: item.title || item.url,
    description,
    alternates: { canonical: `${getSiteUrl()}/items/${item.id}` },
    openGraph: {
      title: item.title || item.url,
      description,
      images: item.imageUrl ? [item.imageUrl] : undefined,
      type: "article",
    },
    twitter: {
      card: item.imageUrl ? "summary_large_image" : "summary",
      title: item.title || item.url,
      description,
    },
  };
}

export default async function ItemDetailPage({ params }: PageProps) {
  const item = await getItem(params.id);
  if (!item) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: item.title || item.url,
    description: item.summary || item.description || undefined,
    image: item.imageUrl || undefined,
    url: item.url,
    keywords: item.tags.join(", "),
    datePublished: item.createdAt,
    dateModified: item.updatedAt,
  };

  return (
    <article className="mx-auto max-w-2xl px-4 py-10">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <a href="/" className="text-sm font-medium text-brand-600 hover:underline">
        ← Back to all items
      </a>

      {item.imageUrl && (
        <img
          src={item.imageUrl}
          alt=""
          className="mt-4 max-h-80 w-full rounded-xl object-cover"
        />
      )}

      <div className="mt-4 flex items-start justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {item.title || item.url}
        </h1>
        <StatusBadge status={item.status} />
      </div>

      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1 block break-all text-sm text-slate-400 hover:text-brand-600"
      >
        {item.url}
      </a>

      {item.summary && <p className="mt-4 text-base leading-relaxed text-slate-700">{item.summary}</p>}

      {item.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {item.tags.map((tag) => (
            <TagPill key={tag} tag={tag} />
          ))}
        </div>
      )}

      <p className="mt-6 text-xs text-slate-400">
        Saved on {new Date(item.createdAt).toLocaleString()}
      </p>
    </article>
  );
}
