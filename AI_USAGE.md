# AI Usage Log

This document describes how AI-assisted development was used for Smart Content Curator and
how the application's Gemini integration is controlled and checked. It is part of the public
repository; it does not contain prompts with secrets, API keys, database URLs, or user data.

## 1. Tools

| Purpose | Tool |
| ------- | ---- |
| Coding assistant | **Claude Code** (Anthropic) and **GitHub Copilot** |
| LLM used *inside the app* | **Google Gemini** via `@google/genai` (`gemini-3.5-flash-lite` by default, configurable), used for the summary + tags feature |

The coding assistants were used for repository exploration, implementation, refactoring,
testing, documentation, and review. Gemini is a runtime dependency of the application and is
separate from the assistants used to develop it.

## 2. Representative prompts and outcomes

### Prompt A: audit before changing anything

> "Audit it against the assignment below, fix everything that's broken or missing, completely
> overhaul the UI … STEP 1 — Explore and report first … Pause and show me this report before
> making big changes." *(abridged; the full prompt listed 7 steps plus the assessment brief)*

**What the AI did:** read every config, schema, route and component; ran typecheck, lint,
tests and the dev server; exercised the API with real requests (save, duplicate, invalid
URLs, 404, filter). It produced a ranked gap report.

**Kept:** the report became the work plan.
**Human decisions:** the project scope, stack, feature priorities, caching strategy, prompt
requirements, deployment approach, and final changes were reviewed by the project owner.
GitHub publishing and deployment were intentionally left as explicit human-controlled steps.

### Prompt B: "Go, with these rules …"

> "Do NOT touch GitHub at all … Local git commits only … fix the Critical and High items
> first, with the UI overhaul as the biggest focus. Then do the Medium items."

**Produced (all kept, after verification):**

| Area | Change |
| ---- | ------ |
| Caching | New `UrlCache` table: metadata (7-day TTL) and AI output (versioned by `PROMPT_VERSION`) keyed by URL hash. Replaced an in-memory `Map` that was lost on restart and not shared between serverless instances. |
| Duplicates | In-flight de-duplication of concurrent saves, and handling of the Prisma `P2002` race (previously a 500). |
| Retry | Retry now works for `FAILED` items too, and "regenerate" for `READY` items keeps the old summary if the AI call fails. |
| Search | Server-side keyword search now also covers tags. Added multi-tag AND filters, sort, tag counts and a total count. |
| HTTP caching | ETag + `304` revalidation on the list endpoint. |
| Contract & errors | Typed browser API client that validates every response. One error shape with an enumerated `ErrorCode`, and id validation on every route. |
| Metadata fetching | Charset-aware decoding, favicon extraction, a `<h1>`/slug title fallback, non-HTML resources saved instead of rejected, readable HTTP error reasons, and IPv6/IPv4-mapped SSRF checks aligned between the two helper functions. |
| AI prompt | Rewritten as a system instruction: short summaries instead of 120–180 words (the brief asks for a *short* summary, and it's cheaper), 3–6 tags normalised in code, page content passed as delimited untrusted data. |
| UI | Complete redesign with design tokens, light/dark/system theme, cards with fallback artwork, staged skeleton for in-flight saves, toasts, undo delete, tag counts, URL-synced filters, `/` shortcut, and a responsive mobile tag scroller. |
| SEO | Generated OG image, SVG icon, manifest, `robots` disallowing `/api/`, `noindex` on unfinished items, escaped JSON-LD. |
| Docs & infra | README rewrite, this log, `docker-compose.yml`, a complete `.env.example`, `DIRECT_URL` for migrations. |

**Edited or discarded:**
- The AI proposed deleting the six old UI components. The deletion was blocked by the
  session's permission rules, and the owner had asked to be consulted before removing code,
  so the new components were written into the **existing filenames** instead.
- The old `shouldRefreshExistingItem` heuristic was dropped: it re-called the AI for any saved
  summary under 80 words, which partly defeated the duplicate cache.

### Prompt C: library pages, pagination and the Summary modal

> "Remove the Library link … Home page: show only 3 items + 'More' box … New page: all saved
> items (/items), 15 per page … server-side (skip/take plus a total count) … Replace the
> Details button with a Summary button … accessible modal … New 'Saved summaries' page …
> Run npm run check … Check /, /items and /summaries in light, dark and 375px mobile with
> headless screenshots." *(abridged)*

**Produced (kept):**
- `GET /api/items` gained `page` and `limit`. Pages are loaded in SQL (`LIMIT/OFFSET` plus a
  matching-row count), a page past the end is clamped to the last page, and page/limit are
  part of the cache key, so each page has its own ETag.
- Pure pagination helpers in `lib/pagination.ts` (page count, skip/take, "…" page list,
  reset to page 1 on filter change, the 3-item home preview) with unit tests.
- Shared client state (`useItemsLibrary`) for the home page, `/items` and `/summaries`, so
  delete-with-undo, retry and regenerate behave the same everywhere.
- A native `<dialog>` Summary modal (Esc, click outside, focus trap, focus return, bottom
  sheet on phones), `/items`, `/summaries`, loading skeletons and an error boundary.

**Human decisions:** keep the per-item pages for SEO even though cards no longer link to
them; local commits only; verify at 375px and in both themes.

### Prompt D: final audit

> "Confirm which folder is the real project … Do a final audit against the original
> assignment brief and the gap report … Fix anything not done, with local commits only."

**Produced (kept):** `DIRECT_URL` added to the local `.env` (so `prisma migrate status` works
again), the summary prompt tightened to 50–80 words with a 90-word hard cap in code
(`PROMPT_VERSION` v4), and this log completed.

Earlier implementation sessions followed the same pattern: ask the assistant to inspect the
current code and tests, propose a focused change, implement it, and run the relevant checks.
Generated code was retained only after review and adjustment against the existing API
contracts, Prisma schema, UI behavior, and test results.

## 3. Where the AI was wrong, and how it was caught

| # | Mistake | How it was caught | Fix |
| - | ------- | ----------------- | --- |
| 1 | The JSON-LD escaping helper was written via a shell heredoc that swallowed a backslash, so `"<"` was replaced with itself instead of `"<"`. A saved page titled `</script>…` could have broken out of the script tag. | The AI ran the helper with `tsx` on `{a:"</script>"}` and saw unescaped output. | Rewrote the replacement with exact bytes and re-verified the output is `</script>`. |
| 2 | The `tags` query parser de-duplicated **before** lowercasing, so `?tags=Frontend,frontend` produced two filters. | A new unit test failed. | Lowercase first, then de-duplicate. |
| 3 | The URL-slug title fallback stripped anything that looked like an extension, turning `arxiv.org/pdf/1706.03762` into the title "1706". `decodeURIComponent` could also throw on malformed `%` sequences and crash a save. | Manual end-to-end test with a real PDF URL. | Strip only known file extensions and guard the decode, with regression tests for both. |
| 4 | For that PDF (no readable text available), Gemini wrote the summary from its *own knowledge* ("foundational Transformer paper"), despite the prompt forbidding invented facts. | Noticed while reading the saved summary. | Non-HTML resources now carry an explicit "PDF document hosted on …" description. The re-run produced a cautious summary that says the full text wasn't available. Remaining risk: URL-only summaries can still lean on model knowledge. |
| 5 | The first Tailwind classes used `border-current/20`, which Tailwind 3 doesn't support (opacity on `currentColor`). | AI self-review before the first render. | Replaced with explicit black/white alpha borders. |
| 6 | The toast component passed a new inline callback on every render, which would have reset every toast's auto-dismiss timer. | AI self-review. | Stable `dismiss(id)` callback with `useCallback`. |
| 7 | Stopping the background dev server left an orphaned Node process holding port 3000 and the Prisma engine DLL (`EPERM` on `prisma generate`). | The `EPERM` error. | Killed the orphaned PID, then regenerated. |
| 8 | Tooling slips: a heredoc splice of `ai.ts` failed on quoting (no file change), and a cleanup script used top-level `await` under CJS. | Command errors. | Re-done with the file-write tool and a wrapped `main()`. |
| 9 | The mobile tag scroller shipped in the UI overhaul let the chips' absolutely positioned screen-reader text escape the scroll container, so at 375px the page could scroll sideways by ~1,700px. Earlier screenshots missed it. | A CDP script measuring `scrollWidth - innerWidth` on every screenshot, then listing the right-most elements. | `relative` on the scroller so the hidden text is clipped with the chips. |
| 10 | While chasing #9, the AI passed arguments to its own screenshot script in the wrong order, got a blank page, and briefly concluded there was no overflow. | The number didn't match the earlier run, so it re-checked the arguments. | Re-ran correctly before drawing conclusions. |
| 11 | Giving `/items` and `/summaries` their own `openGraph` metadata silently dropped the inherited share image. | Grepping the rendered HTML for `og:image`. | Re-attached `/opengraph-image` to those pages. |
| 12 | The Summary modal's "return focus to the button" didn't hold when the button hadn't been focused by the click (as in Safari); the browser's own focus restore won. | Scripted Esc/backdrop checks reported `focusReturned: false`. | Refocus one animation frame after closing; re-verified. |
| 13 | Summaries were meant to be short, but the prompt alone didn't guarantee it: two items saved under the old prompt are ~150 words, and nothing in code stopped a model from overshooting. | Final audit counted words per stored summary. | Prompt now asks for 50–80 words and code caps at 90 (`limitSummaryWords`, unit-tested). Old items shorten when regenerated. |

The mistakes above are retained because they show where AI output needed engineering judgment:
the fixes were made in the repository and then checked with focused tests or manual behavior
checks. They are not a substitute for reviewing model output in a production environment.

## 4. How AI output was verified

- `npm run check` after every step: strict typecheck, ESLint and 63 Vitest tests, plus
  `next build`.
- Real HTTP requests against the running app and the Supabase database:
  - save a new URL, including two concurrent saves of the same URL;
  - delete then re-save (the AI output came back from the cache, identical summary);
  - PDF URL, a site returning 403, retry and regenerate;
  - `ETag` → `304` per page, page clamping, invalid query parameters → `400`.
- Headless Edge driven over the Chrome DevTools Protocol with real device emulation: `/`,
  `/items` and `/summaries` at 1280px, 768px and 375px in light and dark, scripted modal checks
  (Esc, click outside, focus trap, focus return, link `rel`), a horizontal-overflow check and a
  console-error check on every page.

## 5. Review responsibility

Most implementation work was AI-assisted, including boilerplate, UI, tests, and refactoring.
Human review remained responsible for requirements, architecture, security decisions, prompt
wording, acceptance of generated changes, and verification. The exact percentage of
AI-generated code is not a reliable quality measure, so this log records the review process
instead of claiming a precise split.

## 6. Gemini integration in the application

`src/lib/ai.ts` reads `GEMINI_API_KEY`, `GEMINI_MODEL`, and the optional
`GEMINI_FALLBACK_MODEL` from the server environment. The key is never sent to the browser or
written to logs. Gemini receives the normalized URL, page title, description, and a bounded
amount of extracted page text. The application asks for a short summary and topical tags.

The prompt treats fetched page text as untrusted data inside delimiters and tells the model to
ignore instructions found in that text. The response is requested as JSON with a schema,
validated with Zod, normalized in code, and rejected if it does not contain enough usable tags.
Transient failures are retried; malformed output receives one corrective prompt; and a
fallback model can be used for HTTP 503 responses.

## 7. Important limitations

- A model can still produce inaccurate or incomplete summaries, especially when only a title or
  description is available.
- Prompt-injection defenses reduce risk but cannot guarantee that untrusted web content is safe
  or interpreted correctly.
- The current tests validate pure logic and mocked/structured behavior; external Gemini output
  and every provider-specific failure mode cannot be exhaustively tested offline.
- API keys, quotas, model availability, and provider terms remain external dependencies.
