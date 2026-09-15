/**
 * Optional dev-convenience seed. Not required by the assessment, but useful
 * for demoing the filter UI without waiting on live AI/network calls.
 *
 * Run with: npm run db:seed
 */
import { PrismaClient } from "@prisma/client";
import { hashUrl } from "../src/lib/url";

const prisma = new PrismaClient();

const seedItems = [
  {
    url: "https://react.dev/learn",
    title: "Learn React",
    description: "The official React documentation and learning guide.",
    siteName: "react.dev",
    summary:
      "An overview of React's core concepts: components, props, state, and hooks, aimed at developers new to the library.",
    tags: ["react", "frontend", "javascript", "documentation"],
    status: "READY" as const,
  },
  {
    url: "https://www.postgresql.org/docs/current/index.html",
    title: "PostgreSQL Documentation",
    description: "Official manual for PostgreSQL.",
    siteName: "postgresql.org",
    summary:
      "The complete reference manual for PostgreSQL, covering SQL syntax, administration, and server configuration.",
    tags: ["postgres", "database", "sql", "documentation"],
    status: "READY" as const,
  },
];

async function main() {
  for (const item of seedItems) {
    await prisma.item.upsert({
      where: { url: item.url },
      update: {},
      create: { ...item, urlHash: hashUrl(item.url) },
    });
  }
  console.log(`Seeded ${seedItems.length} items.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
