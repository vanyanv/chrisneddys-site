import { describe, expect, it } from "vitest";
import { bagLineImage, clean } from "@/components/shop/bagStore";
import { MAX_PER_ORDER, merch, firstView } from "@/data/merch";

describe("clean", () => {
  it("round-trips valid lines for a real product", () => {
    expect(clean([{ slug: "foam-trucker-blue", qty: 2 }])).toEqual([
      { slug: "foam-trucker-blue", qty: 2 },
    ]);
  });

  it("returns an empty bag for non-array, null, or garbage input", () => {
    expect(clean(null)).toEqual([]);
    expect(clean(undefined)).toEqual([]);
    expect(clean("not an array")).toEqual([]);
    expect(clean({ slug: "foam-trucker-blue", qty: 1 })).toEqual([]);
    expect(clean(42)).toEqual([]);
  });

  it("drops lines for unknown product slugs", () => {
    expect(clean([{ slug: "not-a-real-product", qty: 1 }])).toEqual([]);
  });

  it("drops lines with a missing, zero, negative, or non-numeric quantity", () => {
    expect(clean([{ slug: "foam-trucker-blue" }])).toEqual([]);
    expect(clean([{ slug: "foam-trucker-blue", qty: 0 }])).toEqual([]);
    expect(clean([{ slug: "foam-trucker-blue", qty: -3 }])).toEqual([]);
    expect(clean([{ slug: "foam-trucker-blue", qty: "two" }])).toEqual([]);
    expect(clean([{ slug: "foam-trucker-blue", qty: NaN }])).toEqual([]);
  });

  it("clamps a quantity above MAX_PER_ORDER instead of dropping the line", () => {
    expect(clean([{ slug: "foam-trucker-blue", qty: 999 }])).toEqual([
      { slug: "foam-trucker-blue", qty: MAX_PER_ORDER },
    ]);
  });

  it("floors a fractional quantity", () => {
    expect(clean([{ slug: "foam-trucker-blue", qty: 2.9 }])).toEqual([
      { slug: "foam-trucker-blue", qty: 2 },
    ]);
  });

  it("drops individual garbage entries while keeping the valid ones in a mixed array", () => {
    const input = [
      { slug: "foam-trucker-blue", qty: 3 },
      null,
      { slug: "unknown", qty: 1 },
      { slug: "foam-trucker-blue", qty: -1 },
      "garbage",
    ];
    expect(clean(input)).toEqual([{ slug: "foam-trucker-blue", qty: 3 }]);
  });
});

// A real product from the catalogue, not an invented fixture — see merchLd.test.ts
// for the same convention. The catalogue holds one product today, so this can't
// exercise two distinct *real* slugs; what it does prove is that a line's image
// is resolved from that line's own product, not a shared default — which is the
// bug: every bag line used to render the same generic placeholder regardless of
// which product was actually added.
const trucker = merch.find((p) => p.slug === "foam-trucker-blue");
if (!trucker) throw new Error("expected foam-trucker-blue in the merch catalogue");

describe("bagLineImage", () => {
  it("resolves a line to its own product and that product's first gallery view", () => {
    const image = bagLineImage({ slug: trucker.slug, qty: 1 });
    expect(image).not.toBeNull();
    expect(image?.product).toBe(trucker);
    expect(image?.product.capColor).toBe(trucker.capColor);
    expect(image?.view).toEqual(firstView(trucker));
  });

  it("does not fall back to some other product for a line whose product is gone", () => {
    // A slug that no longer exists in the catalogue (removed drop, stale
    // localStorage) must not resolve to *any* product's art — showing another
    // product's image would be exactly the bug this guards against.
    const image = bagLineImage({ slug: "not-a-real-product", qty: 1 });
    expect(image).toBeNull();
  });

  it("keeps two lines' images independent — same qty, different resolution inputs", () => {
    // Two lines for the same product still each resolve from their own slug
    // rather than sharing one cached/global result.
    const a = bagLineImage({ slug: trucker.slug, qty: 1 });
    const b = bagLineImage({ slug: trucker.slug, qty: 3 });
    expect(a?.product).toBe(b?.product);
    expect(a?.view).toEqual(b?.view);
  });
});
