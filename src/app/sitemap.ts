import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { getSiteUrl } from "@/lib/site";

// Without this, Next.js tries to statically generate sitemap.xml at
// `next build` time, which would require a live DATABASE_URL during the
// build step itself (e.g. on Vercel, before the app is even deployed).
// Forcing dynamic rendering defers the DB query to request time instead.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();

  const items = await prisma.item.findMany({
    where: { status: "READY" },
    select: { id: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
    take: 5000,
  });

  return [
    { url: siteUrl, changeFrequency: "hourly", priority: 1 },
    ...items.map((item) => ({
      url: `${siteUrl}/items/${item.id}`,
      lastModified: item.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
