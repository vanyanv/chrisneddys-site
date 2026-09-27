import { describe, expect, it } from "vitest";
import { cancellationTier, refundForCancel } from "./cancellation";

const HOUR = 60 * 60 * 1000;

describe("cancellationTier", () => {
  it("is free at exactly 48 hours out", () => {
    const now = 0;
    expect(cancellationTier(48 * HOUR, now)).toBe("free");
  });

  it("is free more than 48 hours out", () => {
    expect(cancellationTier(72 * HOUR, 0)).toBe("free");
  });

  it("is half just under 48 hours out", () => {
    expect(cancellationTier(48 * HOUR - 1, 0)).toBe("half");
  });

  it("is half at exactly 24 hours out", () => {
    expect(cancellationTier(24 * HOUR, 0)).toBe("half");
  });

  it("is none just under 24 hours out", () => {
    expect(cancellationTier(24 * HOUR - 1, 0)).toBe("none");
  });

  it("is none for an event that's already passed", () => {
    expect(cancellationTier(-HOUR, 0)).toBe("none");
  });
});

describe("refundForCancel", () => {
  it("refunds in full when free", () => {
    expect(refundForCancel(10000, 48 * HOUR, 0)).toEqual({ tier: "free", refundCents: 10000 });
  });

  it("refunds half, rounded, in the half tier", () => {
    expect(refundForCancel(10001, 24 * HOUR, 0)).toEqual({ tier: "half", refundCents: 5001 });
  });

  it("refunds nothing inside 24 hours", () => {
    expect(refundForCancel(10000, 24 * HOUR - 1, 0)).toEqual({ tier: "none", refundCents: 0 });
  });
});
