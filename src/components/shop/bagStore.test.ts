import { describe, expect, it } from "vitest";
import { clean } from "@/components/shop/bagStore";
import { MAX_PER_ORDER } from "@/data/merch";

describe("clean", () => {
  it("round-trips valid lines for a real product", () => {
    expect(clean([{ slug: "ball-cap", qty: 2 }])).toEqual([{ slug: "ball-cap", qty: 2 }]);
  });

  it("returns an empty bag for non-array, null, or garbage input", () => {
    expect(clean(null)).toEqual([]);
    expect(clean(undefined)).toEqual([]);
    expect(clean("not an array")).toEqual([]);
    expect(clean({ slug: "ball-cap", qty: 1 })).toEqual([]);
    expect(clean(42)).toEqual([]);
  });

  it("drops lines for unknown product slugs", () => {
    expect(clean([{ slug: "not-a-real-product", qty: 1 }])).toEqual([]);
  });

  it("drops lines with a missing, zero, negative, or non-numeric quantity", () => {
    expect(clean([{ slug: "ball-cap" }])).toEqual([]);
    expect(clean([{ slug: "ball-cap", qty: 0 }])).toEqual([]);
    expect(clean([{ slug: "ball-cap", qty: -3 }])).toEqual([]);
    expect(clean([{ slug: "ball-cap", qty: "two" }])).toEqual([]);
    expect(clean([{ slug: "ball-cap", qty: NaN }])).toEqual([]);
  });

  it("clamps a quantity above MAX_PER_ORDER instead of dropping the line", () => {
    expect(clean([{ slug: "ball-cap", qty: 999 }])).toEqual([
      { slug: "ball-cap", qty: MAX_PER_ORDER },
    ]);
  });

  it("floors a fractional quantity", () => {
    expect(clean([{ slug: "ball-cap", qty: 2.9 }])).toEqual([{ slug: "ball-cap", qty: 2 }]);
  });

  it("drops individual garbage entries while keeping the valid ones in a mixed array", () => {
    const input = [
      { slug: "ball-cap", qty: 3 },
      null,
      { slug: "unknown", qty: 1 },
      { slug: "ball-cap", qty: -1 },
      "garbage",
    ];
    expect(clean(input)).toEqual([{ slug: "ball-cap", qty: 3 }]);
  });
});
