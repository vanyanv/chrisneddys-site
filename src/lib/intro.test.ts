import { describe, expect, it } from "vitest";
import { INTRO_GATE_SCRIPT, shouldShowIntro, type ShouldShowIntroInput } from "@/lib/intro";

const BASE: ShouldShowIntroInput = {
  stored: null,
  wide: true,
  finePointer: true,
  reducedMotion: false,
};

describe("shouldShowIntro", () => {
  it("shows for a desktop visitor with no reduced-motion preference, on every visit", () => {
    expect(shouldShowIntro(BASE)).toBe(true);
  });

  it("never shows once the opt-out is stored, whatever its value", () => {
    expect(shouldShowIntro({ ...BASE, stored: "1" })).toBe(false);
    expect(shouldShowIntro({ ...BASE, stored: "" })).toBe(false);
  });

  it("never shows under a narrow (non-desktop) viewport", () => {
    expect(shouldShowIntro({ ...BASE, wide: false })).toBe(false);
  });

  it("never shows without a fine, hover-capable pointer (touch/mobile)", () => {
    expect(shouldShowIntro({ ...BASE, finePointer: false })).toBe(false);
  });

  it("never shows when reduced motion is preferred", () => {
    expect(shouldShowIntro({ ...BASE, reducedMotion: true })).toBe(false);
  });

  it("requires every condition at once", () => {
    expect(
      shouldShowIntro({ stored: null, wide: false, finePointer: false, reducedMotion: true }),
    ).toBe(false);
  });
});

describe("INTRO_GATE_SCRIPT", () => {
  it("never writes to storage, so the intro plays on every visit", () => {
    expect(INTRO_GATE_SCRIPT).not.toContain("setItem");
  });

  it("ignores the old once-per-browser flag", () => {
    expect(INTRO_GATE_SCRIPT).not.toContain("cne-welcome-intro-seen");
  });
});
