import { describe, expect, it } from "vitest";
import { formatSavedDate } from "@/lib/date";

describe("formatSavedDate", () => {
  it("formats the same output regardless of machine locale", () => {
    expect(formatSavedDate("2026-09-22T12:34:00.000Z")).toBe("22 Sept 2026, 12:34");
  });
});