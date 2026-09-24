import { describe, expect, it } from "vitest";
import { EnrichmentResultSchema, MAX_SUMMARY_WORDS, MAX_TAGS, limitSummaryWords, normalizeTags } from "@/lib/ai";

describe("AI output contract", () => {
  it("accepts a short summary with a handful of tags", () => {
    const summary =
      "PostgreSQL 17 adds incremental backups and faster vacuuming, cutting maintenance windows for large clusters. The release also improves JSON handling.";
    expect(
      EnrichmentResultSchema.safeParse({ summary, tags: ["postgres", "databases", "backups"] }).success,
    ).toBe(true);
  });

  it("rejects malformed or underspecified output", () => {
    expect(EnrichmentResultSchema.safeParse({ summary: "", tags: [] }).success).toBe(false);
    expect(EnrichmentResultSchema.safeParse({ summary: "Okay", tags: ["one"] }).success).toBe(false);
    expect(
      EnrichmentResultSchema.safeParse({ summary: "This is too short.", tags: ["one", "two", "three"] }).success,
    ).toBe(false);
    expect(EnrichmentResultSchema.safeParse(null).success).toBe(false);
  });
});

describe("normalizeTags", () => {
  it("lowercases, kebab-cases and strips hashes/punctuation", () => {
    expect(normalizeTags(["#Machine Learning", "Node.js", "  Climate_Policy "])).toEqual([
      "machine-learning",
      "node-js",
      "climate-policy",
    ]);
  });

  it("removes accents, duplicates and generic filler tags", () => {
    expect(normalizeTags(["Café", "cafe", "news", "Article", "postgres"])).toEqual(["cafe", "postgres"]);
  });

  it("caps the number of tags", () => {
    const many = Array.from({ length: 12 }, (_, i) => `topic-${i}`);
    expect(normalizeTags(many)).toHaveLength(MAX_TAGS);
  });
});

describe("limitSummaryWords", () => {
  const sentence = (n: number) => `${Array.from({ length: n - 1 }, (_, i) => `word${i}`).join(" ")} end.`;

  it("leaves summaries within the limit alone", () => {
    const short = sentence(60);
    expect(limitSummaryWords(short)).toBe(short);
  });

  it("trims an overlong summary back to the last full sentence", () => {
    const long = `${sentence(70)} ${sentence(70)}`;
    const result = limitSummaryWords(long);
    expect(result).toBe(sentence(70));
    expect(result.split(" ").length).toBeLessThanOrEqual(MAX_SUMMARY_WORDS);
  });

  it("adds an ellipsis when there is no usable sentence break", () => {
    const run = Array.from({ length: 150 }, (_, i) => `w${i}`).join(" ");
    const result = limitSummaryWords(run);
    expect(result.endsWith("…")).toBe(true);
    expect(result.split(" ")).toHaveLength(MAX_SUMMARY_WORDS);
  });
});
