import { describe, expect, it } from "vitest";
import { clampToWord } from "@/lib/text";

describe("clampToWord", () => {
  it("returns short strings untouched, with no ellipsis added", () => {
    expect(clampToWord("Two smashed patties.", 155)).toBe("Two smashed patties.");
  });

  it("cuts at a word boundary rather than mid-word", () => {
    const text = "Two smashed patties, two slices of cheese, on a buttered Martin's roll.";
    const result = clampToWord(text, 30);
    expect(result.length).toBeLessThanOrEqual(30);
    expect(result.endsWith("…")).toBe(true);
    // The character right before the ellipsis is not mid-word: it is not a
    // letter immediately followed by another letter in the source text.
    expect(result).toBe("Two smashed patties, two…");
  });

  it("trims dangling punctuation left by the cut before adding the ellipsis", () => {
    const text = "Smash-griddled, double-stacked, always fresh, never frozen";
    const result = clampToWord(text, 24);
    expect(result).not.toMatch(/[\s,;:—-]…$/);
    expect(result.endsWith("…")).toBe(true);
  });
});
