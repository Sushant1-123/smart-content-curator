# AI Usage Log

This document records verified AI-assisted work and leaves unknown history as TODOs rather than presenting assumptions as fact.

## Coding assistants used

- GitHub Copilot was used in this session to inspect and modify the existing Smart Content Curator codebase.
- TODO: add any other coding assistants used before this session, if applicable.

## Runtime AI integration

The app uses Google's Gemini API through `@google/genai` in `src/lib/ai.ts`. The default model is `gemini-3.8-flash`, configurable through `GEMINI_MODEL`. Gemini is requested to return structured JSON, and responses are still validated with Zod. Malformed responses receive one retry with a stricter JSON-only instruction.

## Representative prompts

- TODO: record the prompts used during earlier project development if known.
- In this session, the assessment requirements were used as the implementation specification, including SSRF protection, deterministic date rendering, migration verification, and API failure handling.

## Kept, edited, and discarded

- Kept the existing Next.js App Router, Prisma, PostgreSQL, Tailwind, Gemini, and Zod architecture.
- Edited URL validation, metadata fetching, AI model configuration, retry semantics, rate limiting, API response validation, deterministic date formatting, tests, and documentation.
- Discarded no unrelated user changes. TODO: document earlier discarded approaches if they are known.

## Mistakes and detection

- The AI provider uses the official `@google/genai` SDK. The stable `gemini-3.8-flash` model is configurable through `GEMINI_MODEL`.
- Date rendering used an implicit locale on the item detail page; this was identified as the source of possible server/client formatting differences and replaced with a shared UTC `Intl.DateTimeFormat` utility.
- The first SSRF implementation edit produced a malformed intermediate file; strict TypeScript validation caught it immediately, and the module was repaired before continuing.
- TODO: add any earlier AI mistakes and their verification evidence if known.

## Approximate AI-assisted percentage

TODO: estimate the percentage based on the complete development history. It is not inferred here because the earlier hand-written versus AI-assisted split is unknown.
