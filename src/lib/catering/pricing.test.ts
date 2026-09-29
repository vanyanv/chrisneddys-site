import { describe, expect, it } from "vitest";
import {
  describeLine,
  lineAmountCents,
  lineKey,
  MAX_NAME_LENGTH,
  MAX_NOTE_LENGTH,
  quote,
  stripControlChars,
  unitPriceCents,
  validateLine,
} from "./pricing";
import type { CartLine } from "./types";

function line(overrides: Partial<CartLine> = {}): CartLine {
  return {
    itemId: "2-sliders-and-fries",
    qty: 1,
    wayId: "chris",
    toppings: ["lettuce", "tomato", "cne-sauce", "raw-onions"],
    extras: [],
    ...overrides,
  };
}

describe("unitPriceCents", () => {
  it("prices a plain line at the menu price", () => {
    // $17.49
    expect(unitPriceCents(line())).toBe(1749);
  });

  it("adds paid extras", () => {
    expect(unitPriceCents(line({ extras: ["extra-cheese"] }))).toBe(1749 + 100);
  });

  it("adds Make it Halal", () => {
    expect(unitPriceCents(line({ extras: ["make-it-halal"] }))).toBe(1749 + 200);
  });

  it("stacks multiple extras, matching the invoice example ($17.49 + $2.00)", () => {
    expect(unitPriceCents(line({ itemId: "2-sliders-and-fries", extras: ["make-it-halal"] }))).toBe(
      1949,
    );
  });

  it("prices an unknown item at 0", () => {
    expect(unitPriceCents(line({ itemId: "nonexistent" }))).toBe(0);
  });
});

describe("lineAmountCents", () => {
  it("multiplies unit price by quantity", () => {
    expect(lineAmountCents(line({ qty: 30 }))).toBe(1749 * 30);
  });
});

describe("lineKey", () => {
  it("is identical for lines that only differ in topping/extra order", () => {
    const a = line({ toppings: ["lettuce", "tomato"], extras: ["extra-cheese", "make-it-halal"] });
    const b = line({ toppings: ["tomato", "lettuce"], extras: ["make-it-halal", "extra-cheese"] });
    expect(lineKey(a)).toBe(lineKey(b));
  });

  it("treats a blank name/note the same as an absent one", () => {
    const a = line({ forName: "", note: undefined });
    const b = line({});
    expect(lineKey(a)).toBe(lineKey(b));
  });

  it("trims whitespace around name and note before keying", () => {
    const a = line({ forName: "  Dev Patel  " });
    const b = line({ forName: "Dev Patel" });
    expect(lineKey(a)).toBe(lineKey(b));
  });

  it("differs when the item differs", () => {
    const a = line({ itemId: "2-sliders-and-fries" });
    const b = line({ itemId: "the-quad" });
    expect(lineKey(a)).not.toBe(lineKey(b));
  });

  it("differs when the name differs", () => {
    const a = line({ forName: "Dev Patel" });
    const b = line({ forName: "Priya S." });
    expect(lineKey(a)).not.toBe(lineKey(b));
  });

  it("differs when the note differs", () => {
    const a = line({ note: "No onions" });
    const b = line({ note: "Extra napkins" });
    expect(lineKey(a)).not.toBe(lineKey(b));
  });
});

describe("validateLine", () => {
  it("accepts a well-formed line", () => {
    expect(validateLine(line())).toEqual({ ok: true });
  });

  it("rejects an unknown item", () => {
    const result = validateLine(line({ itemId: "nope" }));
    expect(result).toEqual({ ok: false, errors: ["unknown-item"] });
  });

  it("rejects an unknown topping id", () => {
    const result = validateLine(line({ toppings: ["not-a-topping"] }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain("unknown-topping");
  });

  it("rejects an unknown extra id", () => {
    const result = validateLine(line({ extras: ["not-an-extra"] }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain("unknown-extra");
  });

  it("rejects toppings on an item that doesn't take them", () => {
    const result = validateLine(
      line({ itemId: "coca-cola-20-oz-cup", wayId: null, toppings: ["lettuce"] }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain("toppings-not-allowed");
  });

  it("rejects extras on an item that doesn't take toppings", () => {
    const result = validateLine(
      line({ itemId: "coca-cola-20-oz-cup", wayId: null, toppings: [], extras: ["extra-cheese"] }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain("extras-not-allowed");
  });

  it.each([0, -1, 1000, 1.5])("rejects a bad quantity (%s)", (qty) => {
    const result = validateLine(line({ qty }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain("invalid-qty");
  });

  it("accepts the qty boundaries 1 and 999", () => {
    expect(validateLine(line({ qty: 1 })).ok).toBe(true);
    expect(validateLine(line({ qty: 999 })).ok).toBe(true);
  });

  it(`rejects a name over ${MAX_NAME_LENGTH} characters`, () => {
    const result = validateLine(line({ forName: "x".repeat(MAX_NAME_LENGTH + 1) }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain("name-too-long");
  });

  it(`accepts a name at exactly ${MAX_NAME_LENGTH} characters`, () => {
    expect(validateLine(line({ forName: "x".repeat(MAX_NAME_LENGTH) })).ok).toBe(true);
  });

  it(`rejects a note over ${MAX_NOTE_LENGTH} characters`, () => {
    const result = validateLine(line({ note: "x".repeat(MAX_NOTE_LENGTH + 1) }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain("note-too-long");
  });
});

describe("stripControlChars", () => {
  it("removes control characters but keeps ordinary text", () => {
    expect(stripControlChars("No onions\u0007 please\u0000")).toBe("No onions please");
  });
});

describe("describeLine", () => {
  it("describes a way, toppings and extras with menu labels", () => {
    const result = describeLine({
      wayId: "chris",
      toppings: ["lettuce", "tomato", "cne-sauce", "raw-onions"],
      extras: ["make-it-halal"],
    });
    expect(result.wayLabel).toBe("Chris’s Way");
    expect(result.toppingLabels.sort()).toEqual(
      ["Lettuce", "Tomato", "CNE Sauce", "Raw Onions"].sort(),
    );
    expect(result.extraLabels).toEqual(["Make it Halal"]);
  });

  it("has no way label for a custom or null selection", () => {
    expect(describeLine({ wayId: "custom", toppings: [], extras: [] }).wayLabel).toBeNull();
    expect(describeLine({ wayId: null, toppings: [], extras: [] }).wayLabel).toBeNull();
  });
});

describe("quote", () => {
  it("matches the invoice example for a pickup-priced set of lines", () => {
    // o4-invoice-letter-size.png: food $1,132.50, tax $110.42 on that food,
    // tip 10% = $113.25, delivery $25 flat.
    const lines: CartLine[] = [
      line({ qty: 30, wayId: "chris" }),
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
      line({ itemId: "grilled-cheese", qty: 1, wayId: null, toppings: [], forName: "Priya S." }),
      line({
        itemId: "chris-n-eddy-s-slider",
        qty: 1,
        wayId: "custom",
        toppings: ["lettuce", "tomato", "pickles"],
        extras: ["make-it-halal"],
        forName: "Marcus L.",
      }),
      line({ itemId: "the-quad", qty: 1, wayId: "chris" }),
      line({ itemId: "chocolate-shake-20-oz-cup", qty: 20, wayId: null, toppings: [] }),
      line({ itemId: "extra-chris-n-eddy-s-sauce", qty: 20, wayId: null, toppings: [] }),
    ];

    const result = quote(lines, {
      fulfilment: "delivery",
      deliveryFeeCents: 2500,
      freebies: { plates: 60, napkins: 60, utensils: 60 },
    });

    expect(result.foodCents).toBe(113_250);
    expect(result.taxCents).toBe(11_042);
    expect(result.tipCents).toBe(11_325);
    expect(result.deliveryCents).toBe(2500);
    expect(result.totalCents).toBe(113_250 + 11_042 + 11_325 + 2500);
    expect(result.freebies).toEqual({ plates: 60, napkins: 60, utensils: 60 });
  });

  it("charges no delivery fee on pickup", () => {
    const result = quote([line({ qty: 1 })], { fulfilment: "pickup", deliveryFeeCents: 2500 });
    expect(result.deliveryCents).toBe(0);
  });

  it("rounds tax half up at an exact .5-cent boundary", () => {
    // 8 x $0.25 = 200 cents of food; 200 * 9.75% = 19.5 cents exactly,
    // which rounds up to 20, not down to 19.
    const result = quote(
      [
        {
          itemId: "side-of-yellow-chilies",
          qty: 8,
          wayId: null,
          toppings: [],
          extras: [],
        },
      ],
      { fulfilment: "pickup" },
    );
    expect(result.foodCents).toBe(200);
    expect(result.taxCents).toBe(20);
  });

  it("prices an unknown item's line at zero, contributing no tax", () => {
    const result = quote(
      [{ itemId: "nonexistent", qty: 1, wayId: null, toppings: [], extras: [] }],
      {
        fulfilment: "pickup",
      },
    );
    expect(result.foodCents).toBe(0);
    expect(result.taxCents).toBe(0);
  });

  it("supports a custom tip amount instead of a percentage", () => {
    const result = quote([line({ qty: 1 })], { fulfilment: "pickup", tip: { tipCents: 500 } });
    expect(result.tipCents).toBe(500);
  });

  it("defaults freebies to zero when omitted", () => {
    const result = quote([line({ qty: 1 })], { fulfilment: "pickup" });
    expect(result.freebies).toEqual({ plates: 0, napkins: 0, utensils: 0 });
  });
});
