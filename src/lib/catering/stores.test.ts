import { describe, expect, it } from "vitest";
import { CATERING_STORES, isCateringStoreId } from "./stores";

describe("CATERING_STORES", () => {
  it("lists Hollywood and Van Nuys only", () => {
    expect(CATERING_STORES.map((s) => s.id)).toEqual(["hollywood", "vannuys"]);
  });
});

describe("isCateringStoreId", () => {
  it("accepts a catering store id", () => {
    expect(isCateringStoreId("hollywood")).toBe(true);
  });

  it("rejects a non-catering location id", () => {
    expect(isCateringStoreId("glendale")).toBe(false);
    expect(isCateringStoreId("nope")).toBe(false);
  });
});
