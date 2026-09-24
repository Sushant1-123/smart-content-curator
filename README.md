# Smart Content Curator

Save a link. The app fetches the page, asks an LLM (Google Gemini) for a short
summary and topic tags, and adds it to a searchable, filterable reading list
that persists in Postgres.

Built for the Hridayangam Technology full-stack technical assessment.

- **Live app:** ✏️ _add the deployed URL here_
- **Repository:** ✏️ _add the GitHub URL here_

---

## Contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Local setup](#local-setup)
- [Environment variables](#environment-variables)
- [API reference](#api-reference)
- [The AI feature](#the-ai-feature)
- [Caching strategy](#caching-strategy)
- [Type safety](#type-safety)
- [SEO](#seo)
- [Security and robustness](#security-and-robustness)
- [Testing](#testing)
- [Deployment](#deployment)
- [Trade-offs and next steps](#trade-offs-and-next-steps)

## Features

Acceptance criteria:

- [x] **Library view:** each saved item shows its title, source (favicon + domain), image
      (with generated artwork when the page has none), AI summary and AI tags.
- [x] **Save a URL:** the app fetches page metadata, generates a summary and tags with Gemini,
      and adds the item to the list. A skeleton card with staged progress shows while this runs.
- [x] **Filter:** keyword search across title, summary, site, URL *and* tags, combined with
      multi-tag filtering (AND). Server-side SQL, debounced, and reflected in the URL
      (`/?q=cache&tags=http,networking`) so filtered views can be shared and survive reloads.
- [x] **Persistence:** everything lives in Postgres (Supabase in development), so reloading
      keeps every item.

Pages:

- **`/` (home):** save form, filters, and the **3 newest matching items**. Below them, a
  **"+N more saved items →"** card opens `/items` with the current search, tags and sort
  carried over, and a **"📄 Read all N summaries →"** card opens `/summaries`.
- **`/items`:** the whole library as cards, **15 per page**, with the same search, tag chips
  (with counts), sort and clear filters, all in the URL (`/items?q=&tags=&sort=&page=`).
  Changing a filter goes back to page 1. Pagination shows Prev, page numbers (with "…" for long
  ranges) and Next on tablet/desktop, and a compact "‹ Prev  Page X of Y  Next ›" on phones.
- **`/summaries`:** a reading view of every full AI summary, newest first, 15 per page, with a
  search box. Items without a summary show a short "Summary unavailable" note with Retry.
- **Summary modal:** every card's **Summary** button opens an accessible dialog with the title,
  source, saved date, full summary, tags and an "Open original post ↗" button. It closes with
  Esc, a click outside or the close button, keeps focus inside while open, and returns focus to
  the Summary button. On phones it's a bottom sheet.
- **`/items/[id]`:** per-item pages stay for SEO and sharing (listed in `sitemap.xml`).

Extras:

- Light, dark and system themes, with no flash of the wrong theme on load.
- Toasts for every outcome. Delete has a 6-second undo, and a pending delete is still
  sent if the tab closes during that window.
- Retry for failed items, and **Regenerate** for finished ones (the current summary is kept
  if regeneration fails).
- Sort by newest or oldest, tag counts, a result count ("Showing 2 of 8 items tagged
  networking"), clear filters, and a `/` shortcut to focus search.
- Per-item detail pages with their own Open Graph tags and JSON-LD, plus a generated OG image.
- Duplicate protection: tracking parameters, trailing slashes, host case and fragments are
  normalised, so the same article is never saved or summarised twice. Concurrent saves of
  the same URL share one pipeline run.
- Mobile-first responsive layout, keyboard accessible, `prefers-reduced-motion` aware.

## Tech stack

| Layer      | Choice                                                                     |
| ---------- | -------------------------------------------------------------------------- |
| Frontend   | Next.js 14 (App Router), React 18, Tailwind CSS, lucide-react icons        |
| Backend    | Next.js Route Handlers (`src/app/api/**`)                                  |
| Database   | PostgreSQL via Prisma ORM (Supabase in dev; `docker-compose.yml` for local) |
| AI         | Google Gemini (`@google/genai`), structured JSON output                     |
| Scraping   | `cheerio` for Open Graph/meta parsing and readable-text extraction         |
| Contracts  | Zod schemas shared by server and client                                    |
| Tests      | Vitest                                                                     |

## Architecture

```
 Browser (React client components)
   │   typed fetch via lib/apiClient.ts — every response is parsed with the shared Zod schema
   ▼
 Next.js Route Handlers  src/app/api/**            ← validation, HTTP status codes, error shape
   │  GET /api/items ─────► lib/itemQueries.ts      (search / tag filter SQL)
   │  POST /api/items ────► lib/enrichItem.ts       (orchestration, dedupe, statuses)
   │                          ├─► lib/urlCache.ts   (DB cache of metadata + AI output)
   │                          │     ├─► lib/metadata.ts  → the saved web page (SSRF-guarded fetch)
   │                          │     └─► lib/ai.ts        → Google Gemini API
   │                          └─► Prisma
   ▼
 PostgreSQL:  Item (the library)   UrlCache (external-API cache, keyed by URL hash)
```

**Boundaries**

- **Frontend** (`src/components/*`) never imports Prisma, Gemini or any Node module. It talks
  only to `/api/*` through `lib/apiClient.ts`. The server-rendered home page calls the same
  `listItems()` function as `GET /api/items`, so the first render and later client fetches
  always filter the same way.
- **Backend route handlers** stay thin: parse and validate the input, call a domain function,
  and map the result to a status code. All errors share one shape:
  `{ "error": { "message", "code" } }` (`lib/http.ts`).
- **Domain logic** (`lib/enrichItem.ts`, `lib/urlCache.ts`, `lib/metadata.ts`, `lib/ai.ts`,
  `lib/itemQueries.ts`) has no HTTP concerns and is unit-tested where it's pure.
- **Database:** `Item` is the user's library. `UrlCache` stores what the external APIs returned.
  They're separate tables, so deleting an item doesn't throw away work that has already been
  paid for.

```
src/
  app/
    page.tsx                  SSR home page: 3-item preview (reads ?q=&tags=&sort=)
    items/page.tsx            all items, 15 per page (reads ?q=&tags=&sort=&page=)
    summaries/page.tsx        reading view of every summary (reads ?q=&page=)
    items/[id]/page.tsx       per-item detail page with its own metadata
    error.tsx                 error state for a failed server render
    api/items/route.ts        GET list+filter · POST save+enrich
    api/items/[id]/route.ts   GET one · DELETE
    api/items/[id]/retry/     POST retry (FAILED/PARTIAL) or regenerate (READY)
    api/health/route.ts       DB + AI configuration check
    sitemap.ts robots.ts manifest.ts opengraph-image.tsx icon.svg
  components/                 UI (ItemsBoard / AllItemsBoard / SummariesBoard, cards, SummaryDialog,
                              Pagination, filters, toasts, theme)
  lib/                        domain + infrastructure (see diagram)
  types/api.ts                the shared API contract (Zod)
prisma/                       schema + migrations
tests/lib/                    Vitest unit tests
```

## Local setup

**Prerequisites:** Node.js ≥ 18.18, a Postgres database, and a
[Gemini API key](https://aistudio.google.com/apikey).

```bash
# 1. Install dependencies (also runs `prisma generate`)
npm install

# 2. Configure environment
cp .env.example .env        # then fill in the values (see the table below)
                            # DATABASE_URL, DIRECT_URL and GEMINI_API_KEY are required

# 3. Database: pick one
#    a) Supabase/Neon: paste its URLs into .env
#    b) Local Docker:
npm run db:up               # docker compose up -d (Postgres 16 on :5432)

# 4. Apply migrations (uses DIRECT_URL) and check they're applied
npx prisma migrate deploy
npx prisma migrate status   # → "Database schema is up to date!"

# 5. (optional) seed two demo items
npm run db:seed

# 6. Run (one process serves the UI and the API routes)
npm run dev                 # → http://localhost:3000

# 7. Verify
npm run check               # typecheck + lint + tests
curl http://localhost:3000/api/health   # → {"status":"ok","db":"connected",...}
```

Pages: `/` (save + 3 newest items), `/items` (all items, paginated), `/summaries` (reading
view), `/items/[id]` (per-item page).

Useful scripts:

| Script                 | What it does                                      |
| ---------------------- | ------------------------------------------------- |
| `npm run dev`          | Next.js dev server                                |
| `npm run check`        | typecheck + lint + tests (all must pass)          |
| `npm run typecheck`    | `tsc --noEmit` in strict mode                     |
| `npm run lint`         | ESLint (`next/core-web-vitals`)                   |
| `npm test`             | Vitest unit tests                                 |
| `npm run build`        | production build                                  |
| `npm run prisma:deploy`| apply migrations                                  |

## Environment variables

| Variable                | Required | Description                                                                                                                  |
| ----------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`          | yes      | Pooled Postgres URL used by the app. Supabase: **Connect → Transaction pooler** (port 6543), with `?pgbouncer=true` appended. |
| `DIRECT_URL`            | yes*     | Direct/session URL used only by `prisma migrate`. Supabase: **Connect → Session pooler** (port 5432). Local Docker: same as `DATABASE_URL`. |
| `GEMINI_API_KEY`        | yes      | Server-side Gemini key. Never exposed to the browser.                                                                         |
| `GEMINI_MODEL`          | no       | Defaults to `gemini-3.5-flash-lite`.                                                                                         |
| `GEMINI_FALLBACK_MODEL` | no       | Model to try only when the primary returns 503 (overloaded). Empty disables it.                                               |
| `NEXT_PUBLIC_SITE_URL`  | no       | Public base URL for canonical/OG URLs, sitemap and robots. Defaults to `http://localhost:3000`.                              |

\* The running app doesn't read `DIRECT_URL`; only migrations need it.

`.env` and `.env.local` are gitignored. `.env.example` is the template.

## API reference

All responses are JSON and validated against `src/types/api.ts`. Errors always have the shape
`{ "error": { "message": string, "code": ErrorCode } }`.

| Method & path                 | Success                                                         | Errors                                              |
| ----------------------------- | --------------------------------------------------------------- | --------------------------------------------------- |
| `GET /api/items?q=&tags=a,b&sort=newest\|oldest&page=1&limit=15` | `200 { items, tags: {name,count}[], total, matched, page, pageSize, pageCount }` · `304` if the ETag matches | `400 VALIDATION_ERROR`                     |
| `POST /api/items` `{ url }`   | `201 { item, cached:false }` new · `200 { item, cached:true }` already saved | `400 INVALID_JSON / VALIDATION_ERROR / INVALID_URL`, `429 RATE_LIMITED` |
| `GET /api/items/:id`          | `200 { item }`                                                  | `400`, `404 NOT_FOUND`                              |
| `DELETE /api/items/:id`       | `200 { deleted:true, id }`                                      | `400`, `404 NOT_FOUND`                              |
| `POST /api/items/:id/retry`   | `200 { item }`                                                  | `404`, `429`, `502 UPSTREAM_ERROR` (regenerate failed; item unchanged) |
| `GET /api/health`             | `200 { status, db, gemini }`                                    | `503` if the DB is unreachable                      |

**Pagination:** `page` is 1-based (default 1) and `limit` is 1–100 (default 15). The page is
loaded in the database (`LIMIT/OFFSET`, ordered by `createdAt` then `id` so pages never
overlap) alongside a count of the matching rows, so no request loads more than one page. A
page past the end returns the last page (the response's `page` says which). `total` is the
whole library; `matched` is the number of items matching the search and tags. Each
combination of filters, page and limit has its own cache entry and ETag.

Item `status`: `READY` (summarised) · `PARTIAL` (page fetched, AI failed, can retry) ·
`FAILED` (page unreachable, can retry) · `PENDING` (reserved for async enrichment).

## The AI feature

`src/lib/ai.ts`:

- **Prompt:** a system instruction asks for a 2–3 sentence (50–80 word) summary, hard-capped at 90 words in code, and 3–6
  specific, kebab-case topic tags. It explicitly says not to invent facts when only a title
  is available. The page is passed as delimited, untrusted data inside `<page>` tags, and the
  model is told to ignore any instructions inside it (basic prompt-injection hygiene).
- **Input:** title, meta description and up to 8,000 characters of readable text extracted
  from `<article>`/`<main>`, with navigation, scripts and footers stripped.
- **Output:** Gemini's `responseJsonSchema` constrains the shape, and the result is still
  validated with Zod. Tags are then normalised in code: lowercase, accents stripped,
  kebab-case, de-duplicated, generic filler (`news`, `article`, …) dropped, capped at 6.
- **Failures:**
  - A malformed response gets one corrective re-prompt.
  - 429/5xx responses are retried with exponential backoff (up to 3 attempts).
  - A 503 can fail over to `GEMINI_FALLBACK_MODEL`.
  - If everything fails, the item is saved as `PARTIAL` with the reason and a Retry button;
    the save itself never fails because of the AI.
- **Cost:** a flash-lite model, `temperature: 0.2`, `maxOutputTokens: 600`, capped input,
  and the cache below. In practice a given URL is summarised once.

## Caching strategy

| Layer | What | Where | Invalidation |
| ----- | ---- | ----- | ------------ |
| **1. URL dedupe** | A saved, `READY` URL returns the existing row immediately. Zero external calls. | `Item.urlHash` (unique) | n/a |
| **2. External-API cache** | Page metadata and AI output, keyed by SHA-256 of the normalised URL. Survives item deletion, so re-saving a deleted link costs nothing. | `UrlCache` table | Metadata: 7-day TTL. AI output: reused while `promptVersion` matches `PROMPT_VERSION`, so changing the prompt refreshes old summaries lazily. Failures are never cached. |
| **3. In-flight dedupe** | Concurrent saves of the same URL share one promise. | process memory | when the request settles |
| **4. API response memo** | `GET /api/items` results per (query, tags, sort, page, limit). | process memory, 15s TTL | cleared on every write |
| **5. HTTP revalidation** | Strong `ETag` + `Cache-Control: private, no-cache`. Unchanged lists return a body-less `304`. | browser | ETag changes with the content |

Layers 1–2 live in Postgres, so they work across serverless instances and restarts. Layers 3–4
are per-instance; that's fine at this scale, and `lib/responseCache.ts` is the only file that
would change to move to Redis.

## Type safety

- `strict: true`, plus `noUncheckedIndexedAccess` and `noImplicitOverride`. There is no `any`
  in the codebase.
- `src/types/api.ts` is the single contract: route handlers validate requests with it, and
  `lib/apiClient.ts` validates every response with it, so a change on either side is a compile
  error on both.
- Prisma generates the DB types. `lib/serialize.ts` is the one place a DB row becomes a wire DTO.
- The raw SQL used for search returns only ids, and rows are then loaded through Prisma, so
  typed data never comes from an untyped query.

## SEO

- Metadata API: title template, description, keywords, canonical URLs, `robots` rules.
  `/items` and `/summaries` have their own title, description and canonical URL.
  Items that aren't `READY` are `noindex`.
- Open Graph and Twitter cards on every page, a generated 1200×630 OG image
  (`opengraph-image.tsx`), and per-item OG tags (title, summary, image, tags) on `/items/[id]`.
- `sitemap.xml` (home, `/items`, `/summaries` and every `READY` item), `robots.txt` (disallows `/api/`),
  `manifest.webmanifest`, and an SVG favicon.
- JSON-LD: `CollectionPage`/`ItemList` on the home page and `Article` on item pages, escaped
  so page titles can't break out of the script tag.
- Semantic landmarks (`header`, `nav`, `main`, `section`, `article`, `footer`), a skip link,
  one `h1` per page, labelled controls.

## Security and robustness

- **SSRF:** only public `http(s)` URLs are accepted. Every hop, including each redirect, is
  checked after DNS resolution against loopback, private, link-local, CGNAT, multicast and
  IPv6 ULA/link-local ranges (including IPv4-mapped IPv6). Single-label, `.local` and
  `.internal` hosts are rejected.
- **Fetching:** an 8s timeout covers connect, redirects and body; at most 5 redirects; bodies
  capped at 2 MB. Charset comes from the header or `<meta charset>`. Non-HTML resources (PDFs,
  images) are saved with URL-derived metadata instead of being rejected. HTTP errors get
  human-readable reasons (e.g. "HTTP 403: the site blocked automated access").
- **Metadata fallbacks:** title from og → twitter → `<title>` → `<h1>` → URL slug; image from
  og/twitter/`image_src`/itemprop; favicon from `<link rel=icon>` or `/favicon.ico`.
- **Abuse:** `POST` and retry are rate-limited to 10 per minute per client IP (in-memory;
  use Upstash/Redis for multiple instances).
- API keys stay on the server; raw internal errors are logged, never returned.

## Testing

`npm test` runs 63 Vitest unit tests over the pure logic that decides correctness:

- URL normalisation and hashing (the cache key), SSRF rules for IPv4/IPv6
- HTML metadata parsing, fallbacks, charset decoding, non-HTML metadata
- AI output schema and tag normalisation
- API contract parsing (query strings, ids, error codes), ETag matching, format helpers
- Pagination (`lib/pagination.ts`): page count, skip/take, clamping, the "…" page list, the
  reset to page 1 when filters change, per-page cache keys, and the 3-item home limit

The end-to-end flow (save → summary → filter → reload, duplicates, retry, regenerate, delete,
PDF, 403 site) was verified manually against Supabase and Gemini. Next steps would be route
integration tests against a disposable Postgres, and a mocked Gemini client for the retry
paths.

## Deployment

Recommended: **Vercel** (the Next.js app: UI plus API routes) and **Supabase** (Postgres).

1. Push the repository to GitHub.
2. In Supabase, copy the **Transaction pooler** URL (add `?pgbouncer=true`) and the
   **Session pooler** URL.
3. Import the repo in Vercel and set `DATABASE_URL`, `DIRECT_URL`, `GEMINI_API_KEY`,
   `GEMINI_MODEL` (optional) and `NEXT_PUBLIC_SITE_URL` (the production URL).
4. Set the build command to `prisma migrate deploy && next build` so migrations run on deploy.
5. Deploy. The save and retry routes declare `maxDuration = 60`, because a page fetch plus
   Gemini can take several seconds.

Any Node host (Render, Railway, Fly.io) works the same way; no Vercel-only APIs are used.

## Trade-offs and next steps

- **One Next.js app rather than a separate API service:** Route Handlers are the backend
  and the only code that touches Prisma or Gemini. One deploy and one shared contract file
  outweigh independent scaling at this size.
- **Enrichment runs synchronously in the request** (about 3–8s), with a staged skeleton card
  in the UI. Next step: a queue that creates the row as `PENDING`, with polling or SSE for
  instant saves.
- **`<img>` instead of `next/image`:** thumbnails come from arbitrary domains, so a
  `remotePatterns` allowlist isn't possible.
- **Single-tenant** as specified. Next steps: auth with per-user libraries, keyset (cursor)
  pagination for very large libraries, and full-text search (`tsvector`) for relevance ranking.
