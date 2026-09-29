/**
 * The crew ticket's make list (`groupForCrew`) and station totals
 * (`stationCounts`) — see `a5-crew-ticket-letter-size-printed.png`.
 *
 * Both are reconciled by hand against that wireframe's numbers (a 60-person
 * order: three unnamed builds of "2 Sliders and Fries" plus four named
 * single items), which is where the assumptions below come from:
 *
 * - A build's identity is its toppings + extras (sorted, order ignored),
 *   not the raw `wayId` on the line — two lines that end up with the same
 *   toppings always merge into one build, named or not. A named line still
 *   merges with an unnamed one carrying the same build; the named line's
 *   `forName` (repeated `qty` times) is what shows up in that build's
 *   `names`, so a build can have both a count and names attached, exactly
 *   as the build plan describes.
 * - "Make it Halal" makes the *whole build* halal (`CrewBuild.halal`), and
 *   halal patties are counted separately from — not in addition to —
 *   `StationCounts.patties`, matching the wireframe's "207 Patties" main
 *   count against its own separate "26 HALAL patties" row (207 + 26 = the
 *   233 patties the order actually contains).
 * - Toppings are counted per slider, not per line: "2 Sliders and Fries"
 *   is two sliders sharing one topping pick (the item sheet's own "GOES ON
 *   BOTH SLIDERS" label), so a topping on that line is counted twice per
 *   unit ordered. The multiplier is read off the item's own build — the
 *   quantity of its roll line — rather than hard-coded per item id.
 * - "Extra Cheese" adds one cheese slice per unit on top of the item's own
 *   build (a Triple Patty Slider with Extra Cheese counts 3 base slices +
 *   1 = 4), the only extra that changes a station count.
 * - Fries, shakes and extra sauce cups are counted two ways: from a
 *   combo's own build (its `fries()` line) and from the fries/shake/sauce
 *   items on the menu when ordered on their own — both land in the same
 *   total, since either way it's the same fryer/blender/sauce work.
 * - An item with no entry in `src/data/build.ts` (Grilled Cheese and its
 *   combo) contributes nothing to patties/cheese/rolls here; it's simply
 *   not itemised the way a slider is, the same gap `buildFor` documents.
 */
import { allItems, itemById, menu, type MenuItem } from "@/data/menu";
import { buildFor } from "@/data/build";
import { describeLine, resolveWay } from "./pricing";
import { extraById } from "./menu-adapter";
import type { CartLine, CrewBuild, CrewItemGroup, StationCounts } from "./types";

const HALAL_EXTRA_NAME = "Make it Halal";
const EXTRA_CHEESE_NAME = "Extra Cheese";
const SAUCE_CUP_ITEM_ID = "extra-chris-n-eddy-s-sauce";

function lineIsHalal(line: Pick<CartLine, "extras">): boolean {
  return line.extras.some((id) => extraById(id)?.name === HALAL_EXTRA_NAME);
}

function lineHasExtraCheese(line: Pick<CartLine, "extras">): boolean {
  return line.extras.some((id) => extraById(id)?.name === EXTRA_CHEESE_NAME);
}

function buildKey(toppingIds: string[], extraIds: string[]): string {
  return `${[...toppingIds].sort().join(",")}|${[...extraIds].sort().join(",")}`;
}

type BuildAccumulator = {
  toppingIds: string[];
  extraIds: string[];
  halal: boolean;
  count: number;
  /** Insertion-ordered name -> running count, collapsed into `CrewBuild.names`. */
  names: Map<string, number>;
  notes: string[];
};

/**
 * Groups cart lines by menu item (in menu category order), then by exact
 * build. See the module comment for how builds merge and what "halal"
 * means at this level.
 */
export function groupForCrew(lines: CartLine[]): CrewItemGroup[] {
  const byItem = new Map<string, Map<string, BuildAccumulator>>();

  for (const line of lines) {
    if (!itemById(line.itemId)) continue;
    const itemBuilds = byItem.get(line.itemId) ?? new Map<string, BuildAccumulator>();
    byItem.set(line.itemId, itemBuilds);

    const key = buildKey(line.toppings, line.extras);
    const acc = itemBuilds.get(key) ?? {
      toppingIds: line.toppings,
      extraIds: line.extras,
      halal: false,
      count: 0,
      names: new Map<string, number>(),
      notes: [],
    };
    acc.count += line.qty;
    if (lineIsHalal(line)) acc.halal = true;

    const name = line.forName?.trim();
    if (name) {
      acc.names.set(name, (acc.names.get(name) ?? 0) + line.qty);
    }
    const note = line.note?.trim();
    if (note) acc.notes.push(note);

    itemBuilds.set(key, acc);
  }

  const groups: CrewItemGroup[] = [];
  for (const item of allItems) {
    const itemBuilds = byItem.get(item.id);
    if (!itemBuilds) continue;

    const builds: CrewBuild[] = [...itemBuilds.values()].map((acc) => {
      const wayId = resolveWay(acc.toppingIds);
      const desc = describeLine({ wayId, toppings: acc.toppingIds, extras: acc.extraIds });
      return {
        wayId,
        toppingLabels: desc.toppingLabels,
        extraLabels: desc.extraLabels,
        names: [...acc.names.entries()].map(([name, count]) => ({ name, count })),
        notes: acc.notes,
        halal: acc.halal,
        count: acc.count,
      };
    });
    const totalCount = builds.reduce((sum, b) => sum + b.count, 0);
    groups.push({ itemId: item.id, itemName: item.name, totalCount, builds });
  }
  return groups;
}

/** A build's collapsed names for display, e.g. `[{name: "Halal table", count:
 * 6}]` -> "Halal table ×6", or several names each getting their own count
 * only when it's more than one: "Dev Patel, Priya S. ×2". */
export function formatCrewNames(names: CrewBuild["names"]): string {
  return names.map(({ name, count }) => (count > 1 ? `${name} ×${count}` : name)).join(", ");
}

/** How many slider "parts" one unit of an item is, for per-slider topping counts. */
function partsPerUnit(itemId: string): number {
  const build = buildFor(itemId);
  const roll = build?.find((b) => /roll/i.test(b.n));
  return roll?.q ?? 1;
}

const FRIES_SIDE_ITEM_IDS = new Set(
  menu.fries
    .filter((i) => i.id !== "side-of-yellow-chilies" && i.id !== SAUCE_CUP_ITEM_ID)
    .map((i) => i.id),
);
const SHAKE_ITEM_IDS = new Set(menu.drinks.filter((i) => /shake/i.test(i.name)).map((i) => i.id));

function isPattyLine(n: string): boolean {
  return /patty/i.test(n);
}
function isCheeseLine(n: string): boolean {
  return /cheese/i.test(n);
}
function isRollLine(n: string): boolean {
  return /roll/i.test(n);
}
function isFriesLine(n: string): boolean {
  return /fries/i.test(n);
}

/** Griddle/fryer/topping station totals for the crew ticket's summary. */
export function stationCounts(lines: CartLine[]): StationCounts {
  let patties = 0;
  let halalPatties = 0;
  let cheeseSlices = 0;
  let rolls = 0;
  let fries = 0;
  let shakes = 0;
  let sauceCups = 0;
  const toppingsCount: Record<string, number> = {};

  for (const line of lines) {
    const item: MenuItem | undefined = itemById(line.itemId);
    if (!item) continue;

    const halal = lineIsHalal(line);
    const build = buildFor(line.itemId);
    if (build) {
      for (const b of build) {
        const total = b.q * line.qty;
        if (isPattyLine(b.n)) {
          if (halal) halalPatties += total;
          else patties += total;
        } else if (isCheeseLine(b.n)) {
          cheeseSlices += total;
        } else if (isRollLine(b.n)) {
          rolls += total;
        } else if (isFriesLine(b.n)) {
          fries += total;
        }
      }
    }
    if (lineHasExtraCheese(line)) cheeseSlices += line.qty;

    if (item.takesToppings) {
      const multiplier = partsPerUnit(line.itemId) * line.qty;
      for (const toppingId of line.toppings) {
        toppingsCount[toppingId] = (toppingsCount[toppingId] ?? 0) + multiplier;
      }
    }

    if (FRIES_SIDE_ITEM_IDS.has(item.id)) fries += line.qty;
    if (SHAKE_ITEM_IDS.has(item.id)) shakes += line.qty;
    if (item.id === SAUCE_CUP_ITEM_ID) sauceCups += line.qty;
  }

  return {
    patties,
    halalPatties,
    cheeseSlices,
    rolls,
    toppings: toppingsCount,
    fries,
    shakes,
    sauceCups,
  };
}
