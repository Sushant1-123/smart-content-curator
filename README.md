# Smart Content Curator

Save a link, and the app fetches its page metadata and uses an LLM to generate
a short summary and tags — so you can browse and filter your saved reading
list intelligently. Built for the Hridayangam Technology Full Stack Developer
technical assessment.

**Live app:** `LIVE_APP_URL` (replace before submission)
**Repo:** `GITHUB_REPO_URL` (replace before submission)

---

## Contents

- [Feature checklist](#feature-checklist)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Local setup](#local-setup)
- [Environment variables](#environment-variables)
- [Caching strategy](#caching-strategy)
- [Type safety](#type-safety)
- [SEO](#seo)
- [Testing](#testing)
- [Deployment](#deployment)
- [Architecture decisions / trade-offs](#architecture-decisions--trade-offs)
- [Possible next steps](#possible-next-steps)

---

## Feature checklist

Mapped directly to the assessment's acceptance criteria:

- [x] Home page lists saved items: title, source/image, AI summary, AI tags
- [x] Submitting a URL fetches page metadata + generates summary/tags via an
      LLM API, then adds it to the list
- [x] Keyword search and tag filter narrow the list (server-side, debounced)
- [x] Items persist in Postgres — reloading the page keeps everything
- [x] Real backend (Next.js Route Handlers) + real database (Postgres via
      Prisma) — no mock/local-only data
- [x] Caching for both external API calls (page metadata fetch, AI call) and
      the app's own `GET /api/items` responses
- [x] TypeScript strict mode end-to-end, with a single shared contract
      (`src/types/api.ts`, Zod) used by both the API routes and the client
- [x] SEO: per-page metadata, Open Graph/Twitter tags, a **per-item detail
      page** with its own metadata, `sitemap.xml`, `robots.txt`, JSON-LD
      structured data, semantic HTML
- [x] Extras: retry-on-AI-failure, optimistic delete, empty/loading states,
      URL-level dedupe/normalization, a `/api/health` endpoint, unit tests

## Tech stack

| Layer      | Choice                                             |
| ---------- | --------------------------------------------------- |
| Frontend   | Next.js 14 (App Router), React 18, Tailwind CSS      |
| Backend    | Next.js Route Handlers (`src/app/api/**`)            |
| Database   | PostgreSQL, via Prisma ORM                           |
| AI         | Google Gemini API (`@google/genai`)                  |
| Metadata   | `cheerio` (Open Graph / meta tag scraping)           |
| Validation | Zod (shared client/server contract)                  |
| Tests      | Vitest                                               |

One codebase, one framework, deployed as a single Vercel project — this is a
deliberate choice for a small app; see [Architecture decisions](#architecture-decisions--trade-offs)
for why this still cleanly satisfies "frontend, backend, and DB" as separate
concerns rather than being a monolith in the bad sense.

## Architecture

```
src/
  app/
    page.tsx                 # SSR home page (server component, queries Prisma directly)
    items/[id]/page.tsx       # per-item detail page (SSR + per-item SEO metadata)
    sitemap.ts / robots.ts    # SEO
    api/
      items/route.ts          # GET (list+filter), POST (create+enrich)
      items/[id]/route.ts      # DELETE
      items/[id]/retry/route.ts# POST — retry AI enrichment only
      health/route.ts          # liveness check
  components/                 # presentational + client-interactive UI
  lib/
    prisma.ts                 # Prisma client singleton
    metadata.ts                # page metadata fetch + parse (pure + I/O split)
    ai.ts                      # Gemini call + JSON-schema validation + retry
    enrichItem.ts               # orchestrates: cache check -> metadata -> AI -> persist
    responseCache.ts            # in-memory cache for GET /api/items
    rateLimit.ts                # lightweight per-client POST limiter
    date.ts                     # deterministic UTC date formatting
    url.ts                      # normalization, hashing, and SSRF policy
    serialize.ts                 # Prisma row -> wire DTO
  types/api.ts                  # Zod schemas + inferred types shared by client & server
prisma/schema.prisma             # Item model
tests/lib/                       # unit tests for pure logic
```

**Separation of concerns:**
- **Frontend** (`components/*`, client-side `page.tsx` pieces) never talks to
  Prisma or Gemini directly — only to `/api/*` via `fetch`.
- **Backend** (`app/api/**/route.ts`) owns validation, orchestration, and is
  the only layer that touches Prisma or the Gemini SDK.
- **Domain logic** (`lib/enrichItem.ts`, `lib/ai.ts`, `lib/metadata.ts`) is
  factored out of the route handlers so it's independently testable and so
  route handlers stay thin (parse request -> call domain function -> shape
  response).
- **DB access** goes through a single Prisma client singleton; nothing else
  imports `@prisma/client` directly.

**Data flow for "save a URL":**
1. Client `POST /api/items` with `{ url }`.
2. Zod validates the payload.
3. `enrichItem.saveAndEnrichItem` normalizes the URL and checks for an
   existing row by hash — **cache hit** returns immediately, no external
   calls.
4. On a cache miss: fetch page metadata (Open Graph tags via `cheerio`) →
  call the Gemini API for `{ summary, tags }` → persist one row.
5. Failures at either step still persist a usable row (`FAILED` if metadata
   fetch failed, `PARTIAL` if only AI enrichment failed) rather than losing
   the user's save — see [Caching strategy](#caching-strategy) and the AI
   Usage Log for how this was arrived at.
6. The in-memory list-response cache is invalidated so the next `GET`
   reflects the new item.

## Local setup

**Prerequisites:** Node.js ≥ 18.18, a PostgreSQL database (local, Docker, or
a free hosted instance like [Supabase](https://supabase.com) or
[Neon](https://neon.tech)), and a [Gemini API key](https://aistudio.google.com/apikey).

```bash
# 1. Install dependencies
npm install

# 2. Configure environment variables
cp .env.example .env
# then edit .env: set DATABASE_URL and GEMINI_API_KEY

# 3. Apply the committed initial migration
npx prisma migrate deploy

# During schema development, create a new migration with:
npx prisma migrate dev --name init

# 4. (optional) seed a couple of demo items
npm run db:seed

# 5. Run the app
npm run dev
# -> http://localhost:3000
```

**Quick local Postgres with Docker**, if you don't already have one running:

```bash
docker run --name scc-postgres -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=smart_content_curator -p 5432:5432 -d postgres:16
# then: DATABASE_URL="postgresql://postgres:postgres@localhost:5432/smart_content_curator"
```

Other useful scripts:

```bash
npm run typecheck   # tsc --noEmit, strict mode
npm run lint        # eslint (next/core-web-vitals)
npm test            # vitest — unit tests for lib/url.ts, lib/metadata.ts, types/api.ts
npm run build       # production build
```

## Environment variables

| Variable               | Required | Description                                                             |
| ----------------------- | -------- | ------------------------------------------------------------------------ |
| `DATABASE_URL`           | yes      | Postgres connection string (Prisma format)                              |
| `GEMINI_API_KEY`         | yes      | Server-side API key for the Google Gemini API                           |
| `GEMINI_MODEL`           | no       | Defaults to `gemini-3.8-flash`                                          |
| `NEXT_PUBLIC_SITE_URL`   | no       | Base URL used for sitemap/robots/Open Graph absolute URLs                |

See `.env.example` for a ready-to-copy template.

Never commit `.env` or real API keys. For a Supabase transaction-pooler URL,
include `?pgbouncer=true` for Prisma compatibility; use a direct Postgres URL
for migrations when the provider requires it.

## Security and abuse controls

- Only HTTP(S) URLs are accepted. Before each fetch and redirect, the host is
  checked for localhost, loopback, private IPv4, link-local, IPv6 private,
  and cloud metadata destinations. DNS results are checked too.
- Metadata responses are limited to 2 MB, HTML only, and an 8-second timeout.
- `POST /api/items` allows 10 submissions per minute per client key and returns
  `429` with `Retry-After` after that. Multi-instance production deployments
  should replace the in-memory limiter with Redis or Upstash.
- API clients receive safe messages; internal errors are logged server-side.

## Caching strategy

The assessment explicitly asks for caching of **both** external API
responses **and** the app's own API responses. Concretely:

1. **URL-level cache (avoids redundant metadata fetch + AI calls):**
   `Item.url` / `Item.urlHash` are unique. Saving a URL that's already in the
   table returns the existing row (`cached: true` in the response) instead of
   re-fetching the page or re-calling the AI API. This is the main cost
   control, since it means metadata fetch + AI generation happen **at most
   once per distinct URL, ever** — not once per page load. See
   `lib/enrichItem.ts`.
2. **In-memory response cache for `GET /api/items`:**
   `lib/responseCache.ts` memoizes list responses per `(query, tag)` filter
   combination for a short TTL (15s) and is eagerly invalidated on any
   write. This cuts duplicate DB round-trips when the list is polled or
   re-rendered without any actual data change. `Cache-Control` /
   `X-Cache: HIT|MISS` headers are also set for visibility.
3. Deliberately **not** using Redis/external cache infra for this: it's a
   small, single-purpose app, and the in-memory approach is transparent and
   sufficient. Documented in [Architecture decisions](#architecture-decisions--trade-offs)
   with the scaling path if this needed to run across many instances.

## Type safety

- `tsconfig.json` has `"strict": true` plus `noUncheckedIndexedAccess` and
  `noImplicitOverride` for stricter-than-default checking.
- `src/types/api.ts` defines Zod schemas for every request/response shape.
  **Both the API route handlers and the client components import the same
  schemas/types** — there's exactly one definition of what `POST /api/items`
  accepts and returns, so a shape change is a compile error on both sides,
  not a silently-diverging assumption.
- Prisma generates a fully-typed client from `schema.prisma`; `lib/serialize.ts`
  is the single seam that turns a typed Prisma row into the wire DTO.

## SEO

- Per-page `<title>`/`<meta description>` via the Next.js Metadata API
  (`generateMetadata`), including a title template.
- Open Graph + Twitter Card tags on the home page and, more specifically, on
  **each saved item's own detail page** (`/items/[id]`) — so a link shared to
  Slack/iMessage/X shows that item's real title, summary, and image instead
  of generic app-shell metadata.
- `sitemap.xml` (dynamic, includes every successfully-enriched item) and
  `robots.txt`.
- JSON-LD structured data: `ItemList` on the home page, `Article` on each
  item detail page.
- Semantic HTML (`<header>`, `<main>`, `<nav>`, `<article>`, `<footer>`,
  labelled landmarks) and accessible form labels/`aria-*` attributes.

## Testing

`npm test` runs Vitest against the pure/deterministic logic that's cheapest
and most valuable to unit test without mocking the network or the DB:

- `lib/url.ts` — URL normalization and hashing (the basis of the cache key)
- `lib/metadata.ts` — HTML → Open Graph metadata parsing, including the
  relative-image-URL and missing-tag fallback cases
- `types/api.ts` — the Zod request/response contracts

I/O-heavy code (`lib/ai.ts`, the route handlers) is intentionally kept thin
and structured so the parsing/validation/orchestration logic it depends on
*is* unit-testable, rather than mocking `fetch`/Prisma/Gemini end-to-end
inside a time-boxed assessment. Given more time, I'd add integration tests
against a test database (e.g. via `testcontainers`) and a mocked Gemini
client for `lib/ai.ts`'s retry-on-bad-JSON path.

## Deployment

**Suggested stack:** Vercel (frontend + API routes, since they're the same
Next.js app) + Supabase or Neon (managed Postgres).

1. Push this repo to GitHub.
2. Create a Postgres database (Supabase/Neon/Railway) and copy its connection
   string.
3. Run `npx prisma migrate deploy` once against that database (or let it run
   as a Vercel build step — see `vercel.json`-free approach below), i.e. add
   `"vercel-build": "prisma migrate deploy && next build"` as the Vercel
   build command if you want migrations to run automatically on deploy.
4. Import the repo into Vercel → set `DATABASE_URL`, `GEMINI_API_KEY`,
   `GEMINI_MODEL` (optional), and `NEXT_PUBLIC_SITE_URL` (your Vercel URL)
   as environment variables.
5. Deploy. Vercel runs `npm install` → `postinstall` (`prisma generate`) →
   `npm run build`.

Any Node host works the same way (Render, Railway, Fly.io) since this is a
standard Next.js app — no Vercel-specific APIs are used.

## Architecture decisions / trade-offs

- **One Next.js app instead of a separate Express backend + separate SPA:**
  the assessment explicitly allows "serverless functions... or similar" as
  the backend. Next.js Route Handlers *are* the backend here — they're the
  only code that touches Prisma/Gemini, live in their own `api/` tree, and
  are testable/deployable independently of the UI components. This was
  chosen over a separate Express service to avoid duplicating the
  request/response types across two servers and two deploys for an app this
  size; the trade-off is that frontend and backend deploy together rather
  than independently, which matters less at this scale than the type-safety
  win of one shared contract file.
- **`<img>` instead of `next/image` for thumbnails:** `next/image` requires
  an allowlist of remote domains at build time, but this app fetches
  Open Graph images from whatever domain the user pastes a URL for. Rather
  than disabling image optimization only where needed, `images.unoptimized`
  is set globally and thumbnails use a plain `<img loading="lazy">` with an
  `onError` fallback.
- **In-memory response cache, not Redis:** see [Caching strategy](#caching-strategy).
  If this needed to scale to multiple server instances with consistent
  cache invalidation, the swap is: replace `lib/responseCache.ts`'s `Map`
  with Redis (`GET`/`SETEX`) and replace `invalidateItemsCache()`'s local
  `store.clear()` with a `DEL` by key pattern or a pub/sub invalidation
  message — the call sites in `app/api/items/route.ts` and
  `lib/enrichItem.ts` wouldn't need to change.
- **AI failures don't lose the save:** if the Gemini call fails or returns
  malformed JSON (after one retry), the item is still persisted with its
  metadata and marked `PARTIAL`, with a "Retry" action in the UI. Losing a
  user's saved link because a summarization call timed out felt like the
  wrong failure mode for a "save this for later" app.

## Possible next steps

- Background/queued enrichment (e.g. a job queue) instead of enriching
  synchronously inside the `POST` request, so saving feels instant even for
  slow pages, with the row starting in `PENDING` and updating via polling or
  a websocket/SSE push.
- Pagination/infinite scroll once a user's list grows past a page or two.
- Multi-user auth (currently single-tenant, matching the "I am a User"
  acceptance criteria as written).
- Rate limiting on `POST /api/items` to bound Gemini spend per IP/user.
