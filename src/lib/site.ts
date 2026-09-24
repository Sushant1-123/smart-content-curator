export const SITE_NAME = "Smart Content Curator";
export const SITE_TAGLINE = "Your AI-organised reading list";
export const SITE_DESCRIPTION =
  "Save links and articles, and get an AI-written summary and topic tags for each one, so your reading list stays easy to browse, search and filter.";

export function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "http://localhost:3000";
}

/** JSON for a <script type="application/ld+json"> tag; escapes "<" so page titles can't close the tag. */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
