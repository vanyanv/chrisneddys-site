import { describe, expect, it } from "vitest";
import { formatCrewNames, groupForCrew, stationCounts } from "./crew";
import type { CartLine } from "./types";

function line(overrides: Partial<CartLine>): CartLine {
  return {
    itemId: "2-sliders-and-fries",
    qty: 1,
    wayId: null,
    toppings: [],
    extras: [],
    ...overrides,
  };
}

/** The a5-crew-ticket-letter-size-printed.png order: 60 people, mixed. */
const CREW_TICKET_LINES: CartLine[] = [
  line({ qty: 30, wayId: "chris", toppings: ["lettuce", "tomato", "cne-sauce", "raw-onions"] }),
  line({ qty: 20, wayId: "eddy", toppings: ["cne-sauce", "grilled-onions"] }),
  line({
    qty: 6,
    wayId: "custom",
    toppings: ["cne-sauce", "lettuce", "pickles"],
    extras: ["make-it-halal"],
    forName: "Halal table",
    note: "Separate tray, label it",
  }),
  line({
    itemId: "triple-patty-slider",
    qty: 1,
    wayId: "eddy",
    toppings: ["cne-sauce", "grilled-onions"],
    extras: ["extra-cheese"],
    forName: "Dev Patel",
  }),
  line({
    itemId: "grilled-cheese",
    qty: 1,
    note: "Vegetarian: clean spot on the griddle",
    forName: "Priya S.",
  }),
  line({
    itemId: "chris-n-eddy-s-slider",
    qty: 1,
    wayId: "custom",
    toppings: ["lettuce", "tomato", "pickles"],
    extras: ["make-it-halal"],
    note: "No sauce, no onion",
    forName: "Marcus L.",
  }),
  line({
    itemId: "the-quad",
    qty: 1,
    wayId: "chris",
    toppings: ["lettuce", "tomato", "cne-sauce", "raw-onions"],
    forName: "Jordan K.",
  }),
  line({ itemId: "chocolate-shake-20-oz-cup", qty: 20 }),
  line({ itemId: "extra-chris-n-eddy-s-sauce", qty: 20 }),
];

describe("groupForCrew", () => {
  it("orders groups by menu category/order, one group per item", () => {
    const groups = groupForCrew(CREW_TICKET_LINES);
    const ids = groups.map((g) => g.itemId);
    // sliders (chris-n-eddy-s-slider, triple-patty-slider, grilled-cheese)
    // before combos (2-sliders-and-fries) before secret (the-quad) before
    // drinks (chocolate-shake) — extra sauce is a "fries" item.
    expect(ids.indexOf("chris-n-eddy-s-slider")).toBeLessThan(ids.indexOf("2-sliders-and-fries"));
    expect(ids.indexOf("2-sliders-and-fries")).toBeLessThan(ids.indexOf("the-quad"));
    expect(ids.indexOf("the-quad")).toBeLessThan(ids.indexOf("chocolate-shake-20-oz-cup"));
  });

  it("merges unnamed lines with the same exact build into one build", () => {
    const groups = groupForCrew(CREW_TICKET_LINES);
    const combo = groups.find((g) => g.itemId === "2-sliders-and-fries")!;
    expect(combo.totalCount).toBe(56);
    expect(combo.builds).toHaveLength(3);

    const chrisBuild = combo.builds.find((b) => b.wayId === "chris")!;
    expect(chrisBuild.count).toBe(30);
    expect(chrisBuild.names).toEqual([]);

    const halalBuild = combo.builds.find((b) => b.halal)!;
    expect(halalBuild.count).toBe(6);
    expect(halalBuild.wayId).toBe("custom");
    expect(halalBuild.notes).toEqual(["Separate tray, label it"]);
    // The named "Halal table" line still contributes its name, alongside
    // being counted like any other build — collapsed into one entry with a
    // count rather than repeated six times.
    expect(halalBuild.names).toEqual([{ name: "Halal table", count: 6 }]);
  });

  it("gives a named single-item line its own build with its name attached", () => {
    const groups = groupForCrew(CREW_TICKET_LINES);
    const slider = groups.find((g) => g.itemId === "chris-n-eddy-s-slider")!;
    expect(slider.builds).toHaveLength(1);
    expect(slider.builds[0]!.names).toEqual([{ name: "Marcus L.", count: 1 }]);
    expect(slider.builds[0]!.halal).toBe(true);
    expect(slider.builds[0]!.notes).toEqual(["No sauce, no onion"]);
  });

  it("repeats a named line's name qty times", () => {
    const lines = [
      line({
        itemId: "the-quad",
        wayId: "chris",
        toppings: ["lettuce", "tomato", "cne-sauce", "raw-onions"],
        qty: 3,
        forName: "Chris",
      }),
    ];
    const groups = groupForCrew(lines);
    expect(groups[0]!.builds[0]!.names).toEqual([{ name: "Chris", count: 3 }]);
    expect(groups[0]!.builds[0]!.count).toBe(3);
  });

  it("merges two different named lines that land on the same exact build", () => {
    const lines = [
      line({
        itemId: "the-quad",
        wayId: "chris",
        toppings: ["lettuce", "tomato", "cne-sauce", "raw-onions"],
        forName: "A",
      }),
      line({
        itemId: "the-quad",
        wayId: "chris",
        toppings: ["lettuce", "tomato", "cne-sauce", "raw-onions"],
        forName: "B",
      }),
    ];
    const groups = groupForCrew(lines);
    expect(groups[0]!.builds).toHaveLength(1);
    expect(groups[0]!.builds[0]!.count).toBe(2);
    expect(groups[0]!.builds[0]!.names.sort((a, b) => a.name.localeCompare(b.name))).toEqual([
      { name: "A", count: 1 },
      { name: "B", count: 1 },
    ]);
  });

  it("skips lines for items that no longer exist on the menu", () => {
    const groups = groupForCrew([line({ itemId: "does-not-exist" })]);
    expect(groups).toEqual([]);
  });
});

describe("formatCrewNames", () => {
  it("collapses a repeated name into one entry with a count", () => {
    expect(formatCrewNames([{ name: "Halal table", count: 6 }])).toBe("Halal table ×6");
  });

  it("omits the count for names that appear once, and keeps it for those that don't", () => {
    expect(
      formatCrewNames([
        { name: "Dev Patel", count: 1 },
        { name: "Priya S.", count: 2 },
      ]),
    ).toBe("Dev Patel, Priya S. ×2");
  });
});

describe("stationCounts", () => {
  it("matches the crew ticket's station totals", () => {
    const counts = stationCounts(CREW_TICKET_LINES);
    expect(counts.patties).toBe(207);
    expect(counts.halalPatties).toBe(26);
    expect(counts.cheeseSlices).toBe(234);
    expect(counts.rolls).toBe(115);
    expect(counts.fries).toBe(56);
    expect(counts.shakes).toBe(20);
    expect(counts.sauceCups).toBe(20);
    expect(counts.toppings["cne-sauce"]).toBe(114);
    expect(counts.toppings["lettuce"]).toBe(74);
    expect(counts.toppings["tomato"]).toBe(62);
    expect(counts.toppings["raw-onions"]).toBe(61);
    expect(counts.toppings["grilled-onions"]).toBe(41);
    expect(counts.toppings["pickles"]).toBe(13);
  });

  it("counts a standalone fries-category item once per unit", () => {
    const counts = stationCounts([line({ itemId: "straight-cut-fries", qty: 4, wayId: null })]);
    expect(counts.fries).toBe(4);
  });

  it("does not count yellow chilies as fries", () => {
    const counts = stationCounts([line({ itemId: "side-of-yellow-chilies", qty: 4, wayId: null })]);
    expect(counts.fries).toBe(0);
  });
});
