import { describe, expect, it } from "vitest";
import { toppings, ways } from "@/data/menu";
import {
  EXTRAS,
  extraById,
  resolveWay,
  toppingById,
  toppingIdsForWay,
  wayLabel,
} from "./menu-adapter";

describe("EXTRAS", () => {
  it("gives every menu extra a stable slug id", () => {
    expect(EXTRAS).toEqual([
      { id: "extra-cheese", name: "Extra Cheese", price: 1 },
      { id: "make-it-halal", name: "Make it Halal", price: 2 },
    ]);
  });

  it("extraById finds an extra by its id", () => {
    expect(extraById("extra-cheese")?.name).toBe("Extra Cheese");
    expect(extraById("nope")).toBeUndefined();
  });
});

describe("toppingById", () => {
  it("finds a topping by id", () => {
    expect(toppingById("lettuce")?.name).toBe("Lettuce");
    expect(toppingById("nope")).toBeUndefined();
  });
});

describe("toppingIdsForWay", () => {
  it("expands Chris's Way to its topping ids", () => {
    expect(toppingIdsForWay("chris").sort()).toEqual(
      ["lettuce", "tomato", "cne-sauce", "raw-onions"].sort(),
    );
  });

  it("expands Eddy's Way to its topping ids", () => {
    expect(toppingIdsForWay("eddy").sort()).toEqual(["cne-sauce", "grilled-onions"].sort());
  });

  it("covers every tap on every way with a real topping", () => {
    for (const way of ways) {
      expect(toppingIdsForWay(way.id)).toHaveLength(way.taps.length);
    }
  });
});

describe("resolveWay", () => {
  it("returns null for no toppings", () => {
    expect(resolveWay([])).toBeNull();
  });

  it("matches Chris's Way regardless of order", () => {
    expect(resolveWay(["raw-onions", "cne-sauce", "tomato", "lettuce"])).toBe("chris");
  });

  it("matches Eddy's Way", () => {
    expect(resolveWay(["grilled-onions", "cne-sauce"])).toBe("eddy");
  });

  it("returns custom for a selection matching neither way", () => {
    expect(resolveWay(["lettuce", "tomato", "pickles"])).toBe("custom");
  });

  it("returns custom for a subset of a way's toppings", () => {
    expect(resolveWay(["cne-sauce"])).toBe("custom");
  });
});

describe("wayLabel", () => {
  it("labels a way by id", () => {
    expect(wayLabel("chris")).toBe("Chris’s Way");
    expect(wayLabel("eddy")).toBe("Eddy’s Way");
  });
});

describe("topping/way data sanity", () => {
  it("has no duplicate topping ids", () => {
    const ids = toppings.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
