import { describe, expect, it } from "vitest";
import { productTitle } from "./format";

describe("productTitle", () => {
  it("joins both display name lines with a space", () => {
    expect(productTitle("THE FOAM TRUCKER", "— BLUE")).toBe("THE FOAM TRUCKER — BLUE");
  });

  it("trims each line and drops an empty one", () => {
    expect(productTitle("  THE FOAM TRUCKER  ", "")).toBe("THE FOAM TRUCKER");
    expect(productTitle("", "— BLUE")).toBe("— BLUE");
  });

  // The unnamed-draft state (issue #36's decisions comment): both lines
  // blank must come back as "", never a guessed or placeholder name — the
  // caller is what turns "" into an honest "No name yet" note.
  it("returns an empty string for an unnamed draft rather than a placeholder", () => {
    expect(productTitle("", "")).toBe("");
    expect(productTitle("   ", "  ")).toBe("");
  });
});
