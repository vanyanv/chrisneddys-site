import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { photoFraming } from "@/data/photoFocus";
import { menuCardSrcSet, menuPhotoCuts, menuPhotoSrcSet } from "@/lib/menuPhoto";
import cuts from "./menuPhotoCuts.json";
import {
  allItems,
  allPhotosFor,
  drinkGetsPhoto,
  foodMenu,
  isFoodItem,
  menu,
  photoFor,
  SECTION_LEADS,
  SLIDER_STACKS,
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

describe("the menu's opening card", () => {
  it("has the 16:10 photo ladder MenuLead asks for, for each Way", () => {
    const combo = foodMenu.combos.find((i) => i.id === SECTION_LEADS.combos)!;
    for (const way of [undefined, "chris", "eddy"] as const) {
      for (const w of [480, 720, 900]) {
        for (const ext of ["avif", "webp"]) {
          const file = `public/photos/${photoFor(combo, way)}-16x10-${w}.${ext}`;
          expect(existsSync(join(process.cwd(), file)), file).toBe(true);
        }
      }
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

  it("has every size its srcset offers, cut by build-menu-cards.mjs", () => {
    const ids = allItems.flatMap((i) => [i.photo, ...Object.values(i.wayPhotos ?? {})]);
    const files = (srcset: string) => srcset.split(", ").map((c) => c.split(" ")[0] ?? "");
    for (const id of ids.filter((x): x is string => !!x)) {
      // A photo added without running the cutter would fall back to two sizes
      // and never get its sharper ones.
      expect((cuts as Record<string, unknown>)[id], `menuPhotoCuts.json: ${id}`).toBeDefined();
      expect(menuPhotoCuts(id).full).toContain(720);
      for (const ext of ["avif", "webp"] as const) {
        for (const url of [...files(menuPhotoSrcSet(id, ext)), ...files(menuCardSrcSet(id, ext))]) {
          expect(existsSync(join(process.cwd(), "public", url)), url).toBe(true);
        }
      }
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
describe("SLIDER_STACKS", () => {
  const words = ["no", "one", "two", "three", "four"];
  it("names real food items", () => {
    for (const id of Object.keys(SLIDER_STACKS)) {
      expect(
        allItems.some((i) => i.id === id && isFoodItem(i)),
        id,
      ).toBe(true);
    }
  });

  it("matches the cheese count each description states", () => {
    for (const [id, [, cheese]] of Object.entries(SLIDER_STACKS)) {
      const item = allItems.find((i) => i.id === id)!;
      if (id === "the-reverse-bun") continue; // "The Slider, but…": same as the house slider
      const said = new RegExp(`\\b(${words[cheese]}|a) slices? of cheese`, "i");
      expect(item.desc, id).toMatch(said);
    }
  });
});
