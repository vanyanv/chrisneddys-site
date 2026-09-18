import { describe, expect, it } from "vitest";
import { claimPurchase } from "./purchaseDedupe";

/** A minimal in-memory stand-in for `sessionStorage`, so this exercises the
 * same get/set contract `PurchaseOnce.tsx` calls against without a DOM. */
function fakeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  };
}

describe("claimPurchase", () => {
  it("claims an order id it has not seen before", () => {
    expect(claimPurchase(fakeStorage(), "order-1")).toBe(true);
  });

  it("refuses the same order id a second time (a refresh or duplicate mount)", () => {
    const storage = fakeStorage();
    claimPurchase(storage, "order-1");
    expect(claimPurchase(storage, "order-1")).toBe(false);
  });

  it("claims a different order id independently", () => {
    const storage = fakeStorage();
    claimPurchase(storage, "order-1");
    expect(claimPurchase(storage, "order-2")).toBe(true);
  });
});
