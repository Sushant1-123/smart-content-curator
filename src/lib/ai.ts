import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

export class AiGenerationError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AiGenerationError";
  }
}

const EnrichmentResultSchema = z.object({
  summary: z.string().min(1).max(600),
  tags: z.array(z.string().min(1).max(30)).min(1).max(8),
});
export type EnrichmentResult = z.infer<typeof EnrichmentResultSchema>;

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new AiGenerationError(
      "ANTHROPIC_API_KEY is not set. Add it to your .env file (see .env.example).",
    );
  }
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

const MODEL = process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-20241022";

const SYSTEM_PROMPT = `You summarize saved web links for a personal read-it-later app.

Given a page's title, meta description, and URL, respond with ONLY a JSON
object (no markdown fences, no commentary) matching exactly this shape:

{"summary": string, "tags": string[]}

Rules:
- "summary" is 1-3 plain sentences (max ~60 words) describing what the page
  actually covers, written for someone deciding whether to read it later.
  Do not just restate the title.
- "tags" is 3-6 short lowercase topic tags (single words or short kebab-case
  phrases, e.g. "react", "system-design", "personal-finance"). No hashtags,
  no punctuation, no duplicates.
- If the description is missing or too thin to summarize confidently, base
  the summary on the title and URL path, and say so plainly rather than
  inventing specifics.
- Output must be valid JSON and nothing else.`;

/**
 * Calls the Anthropic API to produce a short summary + tags for a saved
 * item. Caching for this call happens one layer up (see enrichItem.ts):
 * we only ever get here on a genuinely new URL.
 */
export async function generateSummaryAndTags(input: {
  url: string;
  title: string | null;
  description: string | null;
}): Promise<EnrichmentResult> {
  const userPrompt = [
    `URL: ${input.url}`,
    `Title: ${input.title ?? "(none found)"}`,
    `Meta description: ${input.description ?? "(none found)"}`,
  ].join("\n");

  const raw = await callAndParse(userPrompt);
  return raw;
}

async function callAndParse(userPrompt: string, attempt = 1): Promise<EnrichmentResult> {
  let text: string;
  try {
    const message = await getClient().messages.create({
      model: MODEL,
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });
    const block = message.content.find((b) => b.type === "text");
    text = block && block.type === "text" ? block.text : "";
  } catch (error) {
    throw new AiGenerationError("Anthropic API request failed", error);
  }

  const parsed = safeParseJson(text);
  const result = EnrichmentResultSchema.safeParse(parsed);

  if (!result.success) {
    // The model occasionally wraps JSON in prose or fences despite
    // instructions. One retry with a stricter nudge catches most of these
    // before we give up and mark the item PARTIAL. This is exactly the kind
    // of "AI output was wrong" case documented in AI_USAGE.md.
    if (attempt < 2) {
      return callAndParse(
        `${userPrompt}\n\nReminder: reply with ONLY the raw JSON object, no other text.`,
        attempt + 1,
      );
    }
    throw new AiGenerationError(
      `AI response did not match expected schema after ${attempt} attempts: ${result.error.message}`,
    );
  }

  // Normalize tags defensively even though the prompt asks for this shape.
  return {
    summary: result.data.summary.trim(),
    tags: Array.from(
      new Set(result.data.tags.map((t) => t.trim().toLowerCase()).filter(Boolean)),
    ),
  };
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
