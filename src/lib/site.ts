export const SITE_NAME = "Smart Content Curator";
export const SITE_DESCRIPTION =
  "Save links and articles and let AI generate summaries and tags so you can browse and filter your reading list intelligently.";

export function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "http://localhost:3000";
}
