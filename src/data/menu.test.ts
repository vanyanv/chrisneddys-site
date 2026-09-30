import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { photoFraming } from "@/data/photoFocus";
import {
  allItems,
  allPhotosFor,
  drinkGetsPhoto,
  foodMenu,
  isFoodItem,
  menu,
  photoFor,
  SECTION_LEADS,
  type MenuCategoryKey,
} from "@/data/menu";

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

describe("SECTION_LEADS", () => {
  it("names a real food item in its own section, with a photo", () => {
    for (const [key, id] of Object.entries(SECTION_LEADS) as [MenuCategoryKey, string][]) {
      const item = foodMenu[key].find((i) => i.id === id);
      expect(item, `${key} lead ${id}`).toBeDefined();
      expect(item!.photo).toBeTruthy();
    }
  });
});

describe("drinkGetsPhoto", () => {
  it("is true for the three shakes only", () => {
    expect(foodMenu.drinks.filter(drinkGetsPhoto).map((i) => i.id)).toEqual([
      "strawberry-shake-20-oz-cup",
      "chocolate-shake-20-oz-cup",
      "vanilla-shake-20-oz-cup",
    ]);
  });
});

describe("menu photo cards", () => {
  it("has a photo for every item the menu draws as a card", () => {
    for (const [key, items] of Object.entries(foodMenu) as [MenuCategoryKey, typeof allItems][]) {
      for (const item of items) {
        if (key === "drinks" && !drinkGetsPhoto(item) && SECTION_LEADS.drinks !== item.id) continue;
        expect(item.photo, `${key}: ${item.id}`).toBeTruthy();
      }
    }
  });
});

describe("photoFor", () => {
  const combo = foodMenu.combos.find((i) => i.id === "2-sliders-and-fries")!;

  it("shows the photo of the Way picked, and the default otherwise", () => {
    expect(photoFor(combo, "eddy")).toBe("combo-2-eddy");
    expect(photoFor(combo, "chris")).toBe("combo-2-chris");
    expect(photoFor(combo)).toBe("combo-2-chris");
  });

  it("has every file the site draws for each photo", () => {
    const ids = allItems.flatMap((i) => [i.photo, ...Object.values(i.wayPhotos ?? {})]);
    for (const id of ids.filter(Boolean)) {
      for (const file of [
        `${id}.webp`,
        `${id}.avif`,
        `${id}-thumb.webp`,
        `${id}-thumb.avif`,
        `${id}-card.webp`,
        `${id}-card.avif`,
      ]) {
        expect(existsSync(join(process.cwd(), "public/menu", file)), file).toBe(true);
      }
      expect(photoFraming[id!], `photoFocus.ts: ${id}`).toBeDefined();
    }
  });
});

describe("allPhotosFor", () => {
  it("lists the default photo first, then the other Ways", () => {
    const combo = foodMenu.combos.find((i) => i.id === "1-slider-and-fries")!;
    expect(allPhotosFor(combo)).toEqual(["combo-1-chris", "combo-1-eddy"]);
    const fries = foodMenu.fries.find((i) => i.id === "cheese-fries")!;
    expect(allPhotosFor(fries)).toEqual(["cheese-fries"]);
  });
});
