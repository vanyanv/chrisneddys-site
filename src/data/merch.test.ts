import { describe, expect, it } from "vitest";
import { firstView, merch, type MerchProduct } from "@/data/merch";

const trucker = merch.find((p) => p.slug === "foam-trucker-blue");
if (!trucker) throw new Error("expected foam-trucker-blue in the merch catalogue");

describe("firstView", () => {
  it("returns the product's first gallery view", () => {
    expect(firstView(trucker)).toBe(trucker.views[0]);
  });

  it("returns undefined, rather than throwing, for a product with no views", () => {
    const noViews: MerchProduct = { ...trucker, views: [] };
    expect(firstView(noViews)).toBeUndefined();
  });
});
