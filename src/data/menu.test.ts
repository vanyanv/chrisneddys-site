import { describe, expect, it } from "vitest";
import { allItems, foodMenu, isFoodItem, menu, type MenuCategoryKey } from "@/data/menu";

const ballCap = allItems.find((i) => i.id === "chris-n-eddy-s-ball-cap-limited-run");

describe("isFoodItem", () => {
  it("is false for the Ball-Cap — it's merch, not food", () => {
    expect(ballCap).toBeDefined();
    expect(isFoodItem(ballCap!)).toBe(false);
  });

  it("is true for an ordinary menu item", () => {
    expect(isFoodItem(menu.sliders[0]!)).toBe(true);
  });
});

describe("foodMenu", () => {
  it("drops the Ball-Cap from Secret Menu while keeping the rest", () => {
    expect(menu.secret.some((i) => i.id === "chris-n-eddy-s-ball-cap-limited-run")).toBe(true);
    expect(foodMenu.secret.some((i) => i.id === "chris-n-eddy-s-ball-cap-limited-run")).toBe(false);
    expect(foodMenu.secret.length).toBe(menu.secret.length - 1);
  });

  it("never contains an isMerch row, in any category", () => {
    for (const key of Object.keys(foodMenu) as MenuCategoryKey[]) {
      for (const item of foodMenu[key]) {
        expect(item.isMerch).toBeFalsy();
      }
    }
  });

  it("does not otherwise change any category's items", () => {
    for (const key of Object.keys(menu) as MenuCategoryKey[]) {
      expect(foodMenu[key]).toEqual(menu[key].filter(isFoodItem));
    }
  });
});
