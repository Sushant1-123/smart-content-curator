import { ApiError, GoogleGenAI } from "@google/genai";
import { z } from "zod";

export class AiGenerationError extends Error {
  constructor(
    message: string,
    public override readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AiGenerationError";
  }
}

export const EnrichmentResultSchema = z.object({
  summary: z.string().min(50).max(2000),
  tags: z.array(z.string().min(1).max(40)).min(4).max(8),
});
export type EnrichmentResult = z.infer<typeof EnrichmentResultSchema>;

const CURRENT_ENRICHMENT_VERSION = "v2";
const aiResponseCache = new Map<string, EnrichmentResult>();

let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (!process.env.GEMINI_API_KEY) {
    throw new AiGenerationError(
      "GEMINI_API_KEY is not set. Add it to your .env file (see .env.example).",
    );
  }
  if (!client) {
    client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return client;
}

const INSTRUCTION_PROMPT = `You are an expert editorial summarization assistant for a research-grade personal content curator.

Your job is to analyze the supplied webpage information and produce a useful, accurate, detailed summary for a user who has saved the article for later reading.

The summary must help the reader understand:
1. What the article is about.
2. The main topic or issue being discussed.
3. The most important facts, arguments, developments, or findings.
4. Important people, organizations, technologies, locations, or events mentioned when supported by the source.
5. Why the information matters or what the key takeaway is.

SUMMARY RULES:
- Write approximately 120-180 words.
- Use 2-4 clear paragraphs OR a well-structured concise summary.
- Do not merely rewrite the title or meta description.
- Do not repeat the same information.
- Extract the most important information from the supplied article content.
- Prioritize factual information over generic statements.
- Preserve important names, dates, numbers, organizations, and events when present.
- Clearly distinguish facts from opinions or claims contained in the article.
- Do not invent information.
- Do not infer facts that are not supported by the provided content.
- If the available webpage content is limited, explicitly make the summary more conservative rather than hallucinating details.
- Do not mention that you are an AI.
- Do not say "This article discusses..." repeatedly.
- Write naturally, like a professional news/editorial summary.
- The summary should allow a user to understand the article's main substance without immediately opening the source.

TAG RULES:
- Generate 4-8 highly relevant tags.
- Lowercase only.
- No hashtags, duplicates, or generic filler tags unless genuinely necessary.
- Prefer specific topics over generic tags.
- Use kebab-case for multi-word tags.

Return ONLY valid JSON matching this shape:
{
  "summary": "120-180 word detailed summary...",
  "tags": ["tag-one", "tag-two", "tag-three", "tag-four"]
}

Do not return markdown, code fences, or explanations outside the JSON.

Use the article content as the primary evidence whenever it is available. If article content is missing or limited, fall back to the title, description, and URL conservatively without inventing details.

Webpage information:
`;

const RESPONSE_JSON_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string", minLength: 50, maxLength: 2000 },
    tags: {
      type: "array",
      minItems: 4,
      maxItems: 8,
      items: { type: "string", minLength: 1, maxLength: 40 },
    },
  },
  required: ["summary", "tags"],
  additionalProperties: false,
} as const;

const TRANSIENT_GEMINI_STATUSES = new Set([429, 500, 503, 504]);
const MAX_GEMINI_ATTEMPTS = 3;
const GEMINI_RETRY_DELAY_MS = 1_000;

/**
 * Calls the Gemini API to produce a short summary + tags for a saved
 * item. Caching for this call happens one layer up (see enrichItem.ts):
 * we only ever get here on a genuinely new URL.
 */
export async function generateSummaryAndTags(input: {
  url: string;
  title: string | null;
  description: string | null;
  content?: string | null;
}): Promise<EnrichmentResult> {
  const cacheKey = `${CURRENT_ENRICHMENT_VERSION}:${input.url}`;
  const cached = aiResponseCache.get(cacheKey);
  if (cached) return cached;

  const cleanedContent = truncateArticleContent(input.content ?? null);
  const userPrompt = [
    `URL: ${input.url}`,
    `Title: ${input.title ?? "(none found)"}`,
    `Meta description: ${input.description ?? "(none found)"}`,
    `Article content: ${cleanedContent ?? "(not available; use title/description/URL only and avoid inventing facts)"}`,
  ].join("\n");

  const raw = await callAndParse(userPrompt);
  aiResponseCache.set(cacheKey, raw);
  return raw;
}

function truncateArticleContent(content: string | null): string | null {
  if (!content) return null;
  const cleaned = content.replace(/\s+/g, " ").trim();
  if (cleaned.length <= 12_000) return cleaned;
  return `${cleaned.slice(0, 12_000).trim()}…`;
}

async function callAndParse(userPrompt: string, attempt = 1): Promise<EnrichmentResult> {
  let text: string;
  try {
    const response = await generateGeminiContent(`${INSTRUCTION_PROMPT}${userPrompt}`);
    text = response.text ?? "";
  } catch (error) {
    throw new AiGenerationError(getClientFacingError(error), error);
  }

  const parsed = safeParseJson(text);
  const result = EnrichmentResultSchema.safeParse(parsed);

  if (!result.success) {
    if (attempt < 2) {
      return callAndParse(
        `${userPrompt}\n\nReminder: return raw JSON only. The "summary" field must be a factual 120-180 word summary based on the provided article content, and the "tags" field must be 4-8 distinct lowercase kebab-case tags.`,
        attempt + 1,
      );
    }
    throw new AiGenerationError(
      `AI response did not match expected schema after ${attempt} attempts: ${result.error.message}`,
    );
  }

  const summary = result.data.summary.trim().replace(/\s+/g, " ");
  if (summary.length < 50 || summary.length > 2000) {
    if (attempt < 2) {
      return callAndParse(
        `${userPrompt}\n\nReminder: ensure the summary is a detailed factual summary with meaningful substance and acceptable length, not a short metadata blurb.`,
        attempt + 1,
      );
    }
    throw new AiGenerationError("AI response summary failed validation after normalization");
  }

  const tags = Array.from(
    new Set(
      result.data.tags
        .map((tag) => tag.trim().toLowerCase())
        .filter((tag) => tag.length > 0 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tag)),
    ),
  );

  if (tags.length < 4 || tags.length > 8) {
    if (attempt < 2) {
      return callAndParse(
        `${userPrompt}\n\nReminder: provide 4-8 distinct lowercase kebab-case tags in the JSON response.`,
        attempt + 1,
      );
    }
    throw new AiGenerationError("AI response contained an invalid number of tags");
  }

  return { summary, tags };
}

async function generateGeminiContent(prompt: string) {
  const models = getConfiguredModels();
  try {
    return await generateWithRetries(prompt, models.primary);
  } catch (error) {
    if (getGeminiStatus(error) === 503 && models.fallback) {
      console.error("Gemini fallback model", { model: models.fallback });
      return generateWithRetries(prompt, models.fallback);
    }
    throw error;
  }
}

interface ConfiguredModels {
  primary: string;
  fallback: string | null;
}

function getConfiguredModels(): ConfiguredModels {
  const primary = process.env.GEMINI_MODEL?.trim();
  if (!primary) {
    throw new AiGenerationError(
      "GEMINI_MODEL is not set. Add a supported model to your .env file (see .env.example).",
    );
  }
  const fallback = process.env.GEMINI_FALLBACK_MODEL?.trim() || null;
  return { primary, fallback: fallback === primary ? null : fallback };
}

async function generateWithRetries(prompt: string, model: string) {
  for (let attempt = 1; attempt <= MAX_GEMINI_ATTEMPTS; attempt += 1) {
    try {
      return await getClient().models.generateContent({
        model,
        contents: prompt,
        config: {
          maxOutputTokens: 800,
          temperature: 0.2,
          responseMimeType: "application/json",
          responseJsonSchema: RESPONSE_JSON_SCHEMA,
        },
      });
    } catch (error) {
      logGeminiFailure(error, model, attempt);
      const status = getGeminiStatus(error);
      const canRetry = status !== null && TRANSIENT_GEMINI_STATUSES.has(status);
      if (!canRetry || attempt === MAX_GEMINI_ATTEMPTS) throw error;
      await delay(GEMINI_RETRY_DELAY_MS * 2 ** (attempt - 1));
    }
  }
  throw new Error("Gemini request attempts exhausted");
}

function logGeminiFailure(error: unknown, model: string, attempt: number): void {
  if (process.env.NODE_ENV === "production") return;

  const info = getGeminiErrorInfo(error);

  console.error("Gemini API ERROR", {
    model,
    attempt,
    status: info.status,
    code: info.code,
    name: error instanceof Error ? error.name : "unknown",
    message: info.message,
    errorStatus: info.errorStatus,
    statusText: info.statusText,
    details: info.details,
    reason: info.reason,
  });
}

function getClientFacingError(error: unknown): string {
  const info = getGeminiErrorInfo(error);
  switch (info.status) {
    case 400:
      return `Gemini request invalid: ${info.message}`;
    case 401:
      return `Gemini API key invalid or missing: ${info.message}`;
    case 403:
      return `Gemini permission denied: ${info.message}`;
    case 404:
      return `Gemini model not found: ${info.message}`;
    case 429:
      return `Gemini quota or rate limit reached after retries: ${info.message}`;
    case 500:
      return `Gemini internal error after retries: ${info.message}`;
    case 503:
      return `Gemini temporarily unavailable after retries: ${info.message}`;
    case 504:
      return `Gemini request timed out after retries: ${info.message}`;
    default:
      return `Gemini API request failed${info.status ? ` (HTTP ${info.status})` : ""}: ${info.message}`;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

interface GeminiErrorInfo {
  status: number | null;
  code: string | number | null;
  message: string;
  errorStatus: string | number | null;
  statusText: string | null;
  details: unknown;
  reason: string | null;
}

function getGeminiErrorInfo(error: unknown): GeminiErrorInfo {
  const details = asRecord(error);
  const payload = parseErrorPayload(error instanceof Error ? error.message : null);
  const payloadError = asRecord(payload?.error);
  const errorObject = asRecord(details?.error);
  const status = getGeminiStatus(error);

  return {
    status,
    code: firstValue(payloadError?.code, payload?.code, errorObject?.code, details?.code),
    message: getErrorMessage(error, payloadError, payload, errorObject),
    errorStatus: firstValue(payloadError?.status, payload?.status, errorObject?.status),
    statusText: getString(payload?.statusText) ?? getString(errorObject?.statusText),
    details: payloadError?.details ?? payload?.details ?? errorObject?.details ?? null,
    reason:
      getString(payloadError?.reason) ??
      getString(payload?.reason) ??
      getString(errorObject?.reason),
  };
}

function getGeminiStatus(error: unknown): number | null {
  const details = asRecord(error);
  if (error instanceof ApiError) return error.status;
  return getNumber(details?.statusCode) ?? getNumber(details?.status);
}

function getErrorMessage(
  error: unknown,
  payloadError: Record<string, unknown> | null,
  payload: Record<string, unknown> | null,
  errorObject: Record<string, unknown> | null,
): string {
  return (
    getString(payloadError?.message) ??
    getString(payload?.message) ??
    getString(errorObject?.message) ??
    (error instanceof Error ? error.message : "Unknown request failure")
  );
}

function parseErrorPayload(message: string | null): Record<string, unknown> | null {
  if (!message) return null;
  try {
    const parsed: unknown = JSON.parse(message);
    return asRecord(parsed);
  } catch {
    return null;
  }
}

function firstValue(...values: unknown[]): string | number | null {
  for (const value of values) {
    if (typeof value === "string" || typeof value === "number") return value;
  }
  return null;
}

function getString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function getNumber(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function safeParseJson(text: string): unknown {
  const trimmed = text.trim();
  // Strip ```json ... ``` fences if the model added them anyway.
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced ? fenced[1] : trimmed;
  try {
    return JSON.parse(candidate ?? "");
  } catch {
    return null;
  }
}
