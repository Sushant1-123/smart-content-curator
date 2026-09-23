import { describe, expect, it } from "vitest";
import { EnrichmentResultSchema } from "@/lib/ai";

describe("AI output contract", () => {
  it("accepts detailed summaries with four to eight relevant tags", () => {
    const summary =
      "The article explains how the new policy changes the operating model for teams handling sensitive data. It outlines the broader market context, describes the technical safeguards being introduced, and notes how regulators are responding to the rollout. The report also examines costs, implementation timelines, and the political debate around the proposal, while distinguishing the government position from independent analyses and affected stakeholders. The result is a practical overview of why the change matters and what it could mean for compliance, adoption, and future governance decisions.";

    expect(
      EnrichmentResultSchema.safeParse({
        summary,
        tags: ["data-governance", "privacy-policy", "regulation", "technology", "compliance"],
      }).success,
    ).toBe(true);
  });

  it("rejects malformed or underspecified output", () => {
    expect(EnrichmentResultSchema.safeParse({ summary: "", tags: [] }).success).toBe(false);
    expect(EnrichmentResultSchema.safeParse({ summary: "Okay", tags: ["one"] }).success).toBe(false);
    expect(
      EnrichmentResultSchema.safeParse({ summary: "This is too short.", tags: ["one", "two", "three"] }).success,
    ).toBe(false);
  });
});