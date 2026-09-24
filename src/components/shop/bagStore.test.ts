import { afterEach, describe, expect, it, vi } from "vitest";
import {
  bagCount,
  bagSubtotal,
  buildBagLine,
  bumpBagLine,
  refreshedBagLine,
  clean,
  reloadBag,
} from "@/components/shop/bagStore";
import { MAX_PER_ORDER, merch, firstView, type MerchProduct } from "@/data/merch";

// A real product from the catalogue, not an invented fixture — see merchLd.test.ts
// for the same convention.
const foundTrucker = merch.find((p) => p.slug === "foam-trucker-blue");
if (!foundTrucker) throw new Error("expected foam-trucker-blue in the merch catalogue");
// Re-typed as non-optional: `line()` and the other closures below capture
// this across a function boundary, which TS does not narrow through.
const trucker: MerchProduct = foundTrucker;

const truckerView = firstView(trucker);
if (!truckerView?.photo) throw new Error("expected the trucker's first view to have a photo");

const expectedImage = {
  url:
    truckerView.photo.thumbUrl ?? `${trucker.photoDir ?? ""}/${truckerView.photo.src}-thumb.webp`,
  alt: truckerView.caption,
};

/** A line snapshot shaped exactly like `buildBagLine` produces one — the
 * fixture `clean()`'s tests validate against. */
function line(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    slug: trucker.slug,
    qty: 2,
    name: trucker.name,
    displayName: trucker.displayName,
    priceCents: Math.round(trucker.price * 100),
    image: expectedImage,
    perOrderLimit: MAX_PER_ORDER,
    addedAt: 1_700_000_000_000,
    ...overrides,
  };
}

describe("buildBagLine", () => {
  it("snapshots the product's display details onto a new line", () => {
    const added = buildBagLine(trucker, 2);
    expect(added).toEqual({
      slug: trucker.slug,
      qty: 2,
      name: trucker.name,
      displayName: trucker.displayName,
      priceCents: Math.round(trucker.price * 100),
      image: expectedImage,
      perOrderLimit: MAX_PER_ORDER,
      addedAt: expect.any(Number),
    });
  });

  it("builds the line image from the product's first view, the same way ProductShot resolves one", () => {
    expect(buildBagLine(trucker, 1).image).toEqual(expectedImage);
  });

  it("falls back to MAX_PER_ORDER when the product has no perOrderLimit of its own", () => {
    expect(trucker.perOrderLimit).toBeUndefined();
    expect(buildBagLine(trucker, 1).perOrderLimit).toBe(MAX_PER_ORDER);
  });

  it("uses the product's own perOrderLimit when it has one, and clamps qty to it", () => {
    const limited: MerchProduct = { ...trucker, perOrderLimit: 2 };
    const added = buildBagLine(limited, 5);
    expect(added.perOrderLimit).toBe(2);
    expect(added.qty).toBe(2);
  });

  it("has no image for a product whose first view has no photo", () => {
    const noPhoto: MerchProduct = {
      ...trucker,
      views: [{ id: "front", label: "FRONT", caption: "no photo yet" }],
    };
    expect(buildBagLine(noPhoto, 1).image).toBeNull();
  });

  it("has no image for a product with no views at all — the empty-catalogue crash this fixes", () => {
    const noViews: MerchProduct = { ...trucker, views: [] };
    expect(buildBagLine(noViews, 1).image).toBeNull();
  });
});

describe("bumpBagLine", () => {
  it("adds qty to the existing line, clamped to the live product's perOrderLimit", () => {
    const existing = buildBagLine(trucker, 1);
    const bumped = bumpBagLine(existing, trucker, 2);
    expect(bumped.qty).toBe(3);
  });

  it("clamps the bump at the product's perOrderLimit rather than letting it overflow", () => {
    const limited: MerchProduct = { ...trucker, perOrderLimit: 3 };
    const existing = buildBagLine(limited, 2);
    const bumped = bumpBagLine(existing, limited, 5);
    expect(bumped.qty).toBe(3);
  });

  it("picks up a perOrderLimit lowered in /admin since the line was first added", () => {
    const existing = buildBagLine(trucker, 4); // added when the limit was MAX_PER_ORDER
    const tightened: MerchProduct = { ...trucker, perOrderLimit: 2 };
    const bumped = bumpBagLine(existing, tightened, 1);
    expect(bumped.perOrderLimit).toBe(2);
    expect(bumped.qty).toBe(2);
  });

  it("leaves every other field of the line untouched", () => {
    const existing = buildBagLine(trucker, 1);
    const bumped = bumpBagLine(existing, trucker, 1);
    expect(bumped.slug).toBe(existing.slug);
    expect(bumped.name).toBe(existing.name);
    expect(bumped.image).toEqual(existing.image);
    expect(bumped.addedAt).toBe(existing.addedAt);
  });
});

describe("refreshedBagLine", () => {
  it("picks up a price changed in /admin since the line was added", () => {
    const existing = buildBagLine(trucker, 2);
    const repriced: MerchProduct = { ...trucker, price: 52 };
    const fresh = refreshedBagLine(existing, repriced);
    expect(fresh.priceCents).toBe(5200);
    expect(fresh.qty).toBe(2);
    expect(fresh.addedAt).toBe(existing.addedAt);
  });

  it("clamps the quantity to a lowered perOrderLimit", () => {
    const existing = buildBagLine(trucker, 4);
    const fresh = refreshedBagLine(existing, { ...trucker, perOrderLimit: 2 });
    expect(fresh.qty).toBe(2);
    expect(fresh.perOrderLimit).toBe(2);
  });

  it("carries the new price through a bump too", () => {
    const existing = buildBagLine(trucker, 1);
    expect(bumpBagLine(existing, { ...trucker, price: 40 }, 1).priceCents).toBe(4000);
  });
});

describe("clean", () => {
  it("round-trips a well-formed line", () => {
    expect(clean([line()])).toEqual([line()]);
  });

  it("returns an empty bag for non-array, null, or garbage input", () => {
    expect(clean(null)).toEqual([]);
    expect(clean(undefined)).toEqual([]);
    expect(clean("not an array")).toEqual([]);
    expect(clean(line())).toEqual([]);
    expect(clean(42)).toEqual([]);
  });

  it("no longer drops a line for a slug the static catalogue doesn't know — the line carries its own snapshot now", () => {
    const stale = line({ slug: "a-product-removed-since-this-line-was-added" });
    expect(clean([stale])).toEqual([stale]);
  });

  it("drops lines missing a name, a two-part displayName, or a slug", () => {
    expect(clean([line({ name: undefined })])).toEqual([]);
    expect(clean([line({ name: "" })])).toEqual([]);
    expect(clean([line({ slug: undefined })])).toEqual([]);
    expect(clean([line({ slug: "" })])).toEqual([]);
    expect(clean([line({ displayName: undefined })])).toEqual([]);
    expect(clean([line({ displayName: ["only one"] })])).toEqual([]);
    expect(clean([line({ displayName: [1, 2] })])).toEqual([]);
  });

  it("drops lines with a missing, zero, negative, or non-numeric quantity", () => {
    expect(clean([line({ qty: undefined })])).toEqual([]);
    expect(clean([line({ qty: 0 })])).toEqual([]);
    expect(clean([line({ qty: -3 })])).toEqual([]);
    expect(clean([line({ qty: "two" })])).toEqual([]);
    expect(clean([line({ qty: NaN })])).toEqual([]);
  });

  it("clamps a quantity above the line's own perOrderLimit instead of dropping the line", () => {
    expect(clean([line({ qty: 999, perOrderLimit: 3 })])).toEqual([
      line({ qty: 3, perOrderLimit: 3 }),
    ]);
  });

  it("floors a fractional quantity", () => {
    expect(clean([line({ qty: 2.9 })])).toEqual([line({ qty: 2 })]);
  });

  it("falls back to MAX_PER_ORDER for a missing, zero, or non-numeric perOrderLimit", () => {
    expect(clean([line({ perOrderLimit: undefined })])[0]?.perOrderLimit).toBe(MAX_PER_ORDER);
    expect(clean([line({ perOrderLimit: 0 })])[0]?.perOrderLimit).toBe(MAX_PER_ORDER);
    expect(clean([line({ perOrderLimit: "six" })])[0]?.perOrderLimit).toBe(MAX_PER_ORDER);
  });

  it("falls back to 0 for a missing or non-numeric priceCents, never a negative one", () => {
    expect(clean([line({ priceCents: undefined })])[0]?.priceCents).toBe(0);
    expect(clean([line({ priceCents: "lots" })])[0]?.priceCents).toBe(0);
    expect(clean([line({ priceCents: -500 })])[0]?.priceCents).toBe(0);
  });

  it("treats a malformed image as no image, without dropping the line", () => {
    expect(clean([line({ image: "not an object" })])[0]?.image).toBeNull();
    expect(clean([line({ image: { url: "" } })])[0]?.image).toBeNull();
    expect(clean([line({ image: { alt: "no url" } })])[0]?.image).toBeNull();
  });

  it("keeps a null image as null", () => {
    expect(clean([line({ image: null })])[0]?.image).toBeNull();
  });

  it("drops individual garbage entries while keeping the valid ones in a mixed array", () => {
    const good = line();
    const input = [good, null, line({ name: "" }), line({ qty: -1 }), "garbage"];
    expect(clean(input)).toEqual([good]);
  });
});

describe("bagCount", () => {
  it("sums quantities across lines, not the number of lines", () => {
    expect(bagCount([line({ qty: 2 }), line({ slug: "other", qty: 3 })])).toBe(5);
  });

  it("is 0 for an empty bag", () => {
    expect(bagCount([])).toBe(0);
  });
});

describe("bagSubtotal", () => {
  it("sums each line's own snapshot price times its quantity, in dollars", () => {
    const a = line({ slug: "a", priceCents: 4800, qty: 2 });
    const b = line({ slug: "b", priceCents: 2500, qty: 1 });
    expect(bagSubtotal([a, b])).toBe(48 * 2 + 25 * 1);
  });

  it("is 0 for an empty bag", () => {
    expect(bagSubtotal([])).toBe(0);
  });
});

describe("reloadBag", () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubStorage(saved: string | null) {
    vi.stubGlobal("window", {
      localStorage: { getItem: () => saved, setItem: () => {}, removeItem: () => {} },
    });
  }

  it("picks up the saved bag, so a page restored from Safari's cache shows what is saved now", () => {
    stubStorage(JSON.stringify({ lines: [line({ qty: 3 })] }));
    expect(reloadBag().map((l) => [l.slug, l.qty])).toEqual([[trucker.slug, 3]]);
  });

  it("empties the in-memory bag when the thanks page already cleared the saved one", () => {
    stubStorage(JSON.stringify({ lines: [line()] }));
    reloadBag();
    stubStorage(JSON.stringify({ lines: [] }));
    expect(reloadBag()).toEqual([]);
  });
});
