# AI Usage Log

This log records how AI tools were used to build this project: what they produced, what was
kept or changed, and where they were wrong. Entries marked **TODO(owner)** are for the
project owner to fill in; they cover work the assistant has no record of.

## 1. Tools

| Purpose | Tool |
| ------- | ---- |
| Coding assistant (this session) | **Claude Code** (Anthropic, model Claude Opus 5.5), run in the project folder with shell, file-edit and headless-browser access |
| Coding assistant (earlier sessions) | GitHub Copilot, per the previous version of this log. TODO(owner): confirm, and add any other tools used |
| LLM used *inside the app* | **Google Gemini** via `@google/genai` (`gemini-3.5-flash-lite` by default, configurable), used for the summary + tags feature |

## 2. Representative prompts and outcomes

### Prompt A: audit before changing anything

> "Audit it against the assignment below, fix everything that's broken or missing, completely
> overhaul the UI … STEP 1 — Explore and report first … Pause and show me this report before
> making big changes." *(abridged; the full prompt listed 7 steps plus the assessment brief)*

**What the AI did:** read every config, schema, route and component; ran typecheck, lint,
tests and the dev server; exercised the API with real requests (save, duplicate, invalid
URLs, 404, filter). It produced a ranked gap report.

**Kept:** the report became the work plan.
**Human decisions:**
- commit the uncommitted Gemini migration first as separate commits;
- keep the stack (Next.js, Prisma, Supabase, Gemini, Tailwind);
- keep Supabase for development and add `docker-compose.yml` for others;
- no GitHub or deployment actions by the AI.

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
| AI prompt | Rewritten as a system instruction: 40–80 word summaries instead of 120–180 (the brief asks for a *short* summary, and it's cheaper), 3–6 tags normalised in code, page content passed as delimited untrusted data. |
| UI | Complete redesign with design tokens, light/dark/system theme, cards with fallback artwork, staged skeleton for in-flight saves, toasts, undo delete, tag counts, URL-synced filters, `/` shortcut, and a responsive mobile tag scroller. |
| SEO | Generated OG image, SVG icon, manifest, `robots` disallowing `/api/`, `noindex` on unfinished items, escaped JSON-LD. |
| Docs & infra | README rewrite, this log, `docker-compose.yml`, a complete `.env.example`, `DIRECT_URL` for migrations. |

**Edited or discarded:**
- The AI proposed deleting the six old UI components. The deletion was blocked by the
  session's permission rules, and the owner had asked to be consulted before removing code,
  so the new components were written into the **existing filenames** instead.
- The old `shouldRefreshExistingItem` heuristic was dropped: it re-called the AI for any saved
  summary under 80 words, which partly defeated the duplicate cache.

### Prompt C: TODO(owner)

TODO(owner): add prompts from earlier sessions (initial scaffold, first Anthropic
implementation, the switch to Gemini) and what you kept or changed from each.

## 3. Where the AI was wrong, and how it was caught

| # | Mistake | How it was caught | Fix |
| - | ------- | ----------------- | --- |
| 1 | The JSON-LD escaping helper was written via a shell heredoc that swallowed a backslash, so `"<"` was replaced with `"<"` (a no-op). A saved page titled `</script>…` could have broken out of the script tag. | The AI ran the helper with `tsx` on `{a:"</script>"}` and saw unescaped output. | Rewrote the replacement with exact bytes and re-verified the output is `</script>`. |
| 2 | The `tags` query parser de-duplicated **before** lowercasing, so `?tags=Frontend,frontend` produced two filters. | A new unit test failed. | Lowercase first, then de-duplicate. |
| 3 | The URL-slug title fallback stripped anything that looked like an extension, turning `arxiv.org/pdf/1706.03762` into the title "1706". `decodeURIComponent` could also throw on malformed `%` sequences and crash a save. | Manual end-to-end test with a real PDF URL. | Strip only known file extensions and guard the decode, with regression tests for both. |
| 4 | For that PDF (no readable text available), Gemini wrote the summary from its *own knowledge* ("foundational Transformer paper"), despite the prompt forbidding invented facts. | Noticed while reading the saved summary. | Non-HTML resources now carry an explicit "PDF document hosted on …" description. The re-run produced a cautious summary that says the full text wasn't available. Remaining risk: URL-only summaries can still lean on model knowledge. |
| 5 | The first Tailwind classes used `border-current/20`, which Tailwind 3 doesn't support (opacity on `currentColor`). | AI self-review before the first render. | Replaced with explicit black/white alpha borders. |
| 6 | The toast component passed a new inline callback on every render, which would have reset every toast's auto-dismiss timer. | AI self-review. | Stable `dismiss(id)` callback with `useCallback`. |
| 7 | Stopping the background dev server left an orphaned Node process holding port 3000 and the Prisma engine DLL (`EPERM` on `prisma generate`). | The `EPERM` error. | Killed the orphaned PID, then regenerated. |
| 8 | Tooling slips: a heredoc splice of `ai.ts` failed on quoting (no file change), and a cleanup script used top-level `await` under CJS. | Command errors. | Re-done with the file-write tool and a wrapped `main()`. |

TODO(owner): add mistakes from earlier sessions, e.g. the Anthropic → Gemini switch and the
`override` / sitemap build-time fixes visible in the git history.

## 4. How AI output was verified

- `npm run check` after every step: strict typecheck, ESLint, and 44 Vitest tests.
- Real HTTP requests against the running app and the Supabase database:
  - save a new URL, including two concurrent saves of the same URL;
  - delete then re-save (the AI output came back from the cache, identical summary);
  - PDF URL, a site returning 403, retry and regenerate;
  - `ETag` → `304`, invalid query parameters → `400`.
- Headless Chrome screenshots at 1440px (dark), 1280px (filtered, dark) and 375px (light, in
  an iframe, because headless Chrome enforces a minimum window width), plus a console-error
  check.

## 5. Rough split: AI-assisted vs hand-written

- **This session:** almost all code changes were written by the AI assistant (roughly 90%+).
  The human contribution was direction and decisions: priorities, scope limits (no GitHub or
  deploy), stack choices, and reviewing the reports.
- **Whole project:** TODO(owner): estimate the overall percentage and explain why (for example:
  "~X% AI-generated, since boilerplate and UI were delegated; the data model, caching design
  and review were mine").
