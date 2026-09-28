import { describe, expect, it } from "vitest";
import { allItems } from "@/data/menu";
import { COMBO_FOR, comboFor } from "@/data/upsell";

describe("COMBO_FOR", () => {
  it("only names items that exist, on both sides", () => {
    for (const [from, to] of Object.entries(COMBO_FOR)) {
      expect(allItems.some((i) => i.id === from)).toBe(true);
      expect(allItems.some((i) => i.id === to)).toBe(true);
    }
  });

  it("always suggests something that costs more, so it reads as an upgrade", () => {
    for (const [from, to] of Object.entries(COMBO_FOR)) {
      const a = allItems.find((i) => i.id === from)!;
      const b = allItems.find((i) => i.id === to)!;
      expect(b.price).toBeGreaterThan(a.price);
    }
  });
});

describe("comboFor", () => {
  it("points the signature slider at 1 Slider and Fries", () => {
    const slider = allItems.find((i) => i.id === "chris-n-eddy-s-slider")!;
    expect(comboFor(slider)?.name).toBe("1 Slider and Fries");
  });

  it("suggests nothing for a combo", () => {
    const combo = allItems.find((i) => i.id === "1-slider-and-fries")!;
    expect(comboFor(combo)).toBeUndefined();
  });
});
