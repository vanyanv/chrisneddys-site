import { describe, expect, it } from "vitest";
import { estimateMiles, inRange, type ZipDistanceLookup } from "./range";

describe("estimateMiles", () => {
  it("applies the 1.25 driving fudge factor and rounds to 0.1 mile", () => {
    const lookup: ZipDistanceLookup = () => 8;
    expect(estimateMiles("90028", "91405", lookup)).toBe(10); // 8 * 1.25
  });

  it("rounds to one decimal place", () => {
    const lookup: ZipDistanceLookup = () => 3.33;
    expect(estimateMiles("90028", "91405", lookup)).toBe(4.2); // 3.33 * 1.25 = 4.1625 -> 4.2
  });

  it("returns null for an unknown ZIP instead of throwing", () => {
    const lookup: ZipDistanceLookup = () => null;
    expect(estimateMiles("90028", "00000", lookup)).toBeNull();
  });

  it("uses the real zipcodes package by default", () => {
    // Hollywood (90028) to Van Nuys (91405), the two catering stores.
    const miles = estimateMiles("90028", "91405");
    expect(miles).not.toBeNull();
    expect(miles).toBeGreaterThan(0);
  });
});

describe("inRange", () => {
  it("is true at or under the limit", () => {
    expect(inRange(10, 10)).toBe(true);
    expect(inRange(9.9, 10)).toBe(true);
  });

  it("is false over the limit", () => {
    expect(inRange(10.1, 10)).toBe(false);
  });

  it("is false for an unknown (null) distance", () => {
    expect(inRange(null, 10)).toBe(false);
  });
});
