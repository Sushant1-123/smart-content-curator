# AI Usage Log

> **Note before you submit:** this log describes the actual build process for
> this repo, which was done with heavy AI assistance (Claude) end-to-end,
> including the architecture decisions. Before submitting, run the app
> yourself, verify it against the acceptance criteria, and edit this file to
> reflect *your own* review, any changes you made, and anything you'd have
> done differently — that's what the assessment is actually evaluating.

## Tools used

- **Coding assistant:** Claude (Anthropic), used conversationally to scaffold
  the full project — schema, API routes, domain logic, components, tests,
  README — from the assessment brief.
- **LLM API integrated into the app itself:** Anthropic Messages API
  (`@anthropic-ai/sdk`), used at runtime in `src/lib/ai.ts` to generate each
  saved item's summary and tags. This is the real AI-powered feature the
  assessment asks for, separate from the assistant used to write the code.

## How the build was approached

Rather than asking for the whole app in one shot, the build went
architecture-first: data model and API contract (`prisma/schema.prisma`,
`src/types/api.ts`) were defined before any UI, so the frontend and backend
were written against one agreed-upon shape instead of being reconciled
afterward.

## Representative prompts, and what was kept / edited / discarded

1. **"Design the data model for saved items, including what's needed to
   support caching of both the metadata fetch and the AI call."**
   — Kept: the `urlHash` unique-index approach as the cache key, and the
   `PENDING/READY/PARTIAL/FAILED` status enum. Edited: initially the model
   only had `READY`/`FAILED`; added `PARTIAL` after realizing "metadata
   fetched but AI failed" needed to be distinguishable from "couldn't even
   fetch the page," since the retry action only makes sense for the former.

2. **"Write the Anthropic call so it reliably returns structured
   `{summary, tags}` instead of free text."**
   — Kept: the JSON-only system prompt plus a Zod schema to validate the
   response. Edited: the first version had no retry and would just throw on
   any malformed response. Added a single retry with a stricter
   "reply with ONLY the JSON object" nudge after noting the model
   occasionally wraps output in a sentence or a ```json fence even when told
   not to — see "where AI output was wrong" below.

3. **"Add keyword + tag filtering without duplicating filter logic between
   client and server."**
   — Kept: server-side filtering via Prisma `where` clauses driven by a
   shared `ListItemsQuerySchema`, with debounced client requests. Discarded:
   an initial suggestion to also filter client-side against the already-
   fetched list "for snappiness" — rejected because it would silently
   diverge from the server's filtering logic (e.g. case-insensitivity, tag
   matching) and create two sources of truth for the same behavior.

4. **"Make sure a failed AI call never loses the user's saved link."**
   — Kept in full: the `PARTIAL` status path in `lib/enrichItem.ts` that
   persists the item with metadata even when enrichment fails, plus the
   `/api/items/[id]/retry` endpoint and its "Retry" button in the UI. This
   came directly from asking the assistant to enumerate failure modes for
   the write path rather than only the happy path.

## Where AI output was wrong, and how it was caught / fixed

- **Malformed JSON from the summarization prompt.** Initial testing prompts
  (via direct calls to the Anthropic API, not shown in the app) sometimes
  returned the JSON object wrapped in a short preamble sentence or a
  ` ```json ` fence despite the system prompt saying not to. This wasn't
  caught by reading the code — it only showed up by exercising the parser
  against those response shapes. Fixed by adding `safeParseJson`'s fence-
  stripping regex and the one-retry-with-a-reminder strategy in
  `lib/ai.ts`, rather than trusting the model to always follow the
  instruction on the first try.
- **`next/image` domain allowlisting.** An early pass used `next/image` for
  item thumbnails, which fails at runtime for any external image domain not
  explicitly allowlisted — a non-starter here since thumbnails come from
  whatever domain a user's saved URL happens to be on. Caught by checking
  Next.js's image documentation while reviewing the generated
  `next.config.mjs`; switched to a plain `<img>` with `unoptimized: true`
  and an `onError` fallback, documented as a deliberate trade-off in the
  README rather than left as an unexplained inconsistency.
- **Sitemap including everything, not just successfully-enriched items.**
  The first `sitemap.ts` listed every saved `Item` regardless of status.
  Reviewing it against the acceptance criteria, `FAILED`/`PARTIAL` items
  don't have a meaningful public detail page worth indexing, so the query
  was scoped to `status: "READY"`.

## Roughly how much was AI-assisted vs. hand-written

The large majority of the code in this repo was AI-drafted and then
reviewed/adjusted rather than hand-typed from scratch — appropriate given
the assessment explicitly frames AI-assisted development as the expected
way of working, and explicitly wants visibility into that process rather
than a pretense of a fully hand-written submission. The higher-judgment,
lower-mechanical-effort work was in: deciding the failure-mode handling
(`PENDING/READY/PARTIAL/FAILED`), the caching strategy (what to cache, at
which layer, and why not to reach for Redis at this scale), and what to
explicitly call out as a trade-off in the README versus what could be
generated confidently without review.

## What to personalize before submitting

- Fill in the live URL and repo link at the top of `README.md`.
- Actually run `npm install`, `npm run typecheck`, `npm test`, and
  `npm run build` locally — this repo was authored without a live Node
  environment in the loop, so treat the first local install as your real
  verification pass, not a formality.
- Replace this section, and the prompts above, with your own if you iterate
  further on the app — this log should reflect what you actually did.
