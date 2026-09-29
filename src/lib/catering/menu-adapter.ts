/**
 * A thin layer over `src/data/menu.ts` for catering.
 *
 * `menu.ts` is a mirror of the Otter storefront and deliberately gives
 * extras no id of their own (Otter doesn't need one). Catering carts need
 * stable ids for `CartLine.extras`, and need to know which topping ids a
 * "Way" preset expands to, so both live here rather than inside `menu.ts`.
 */
import { extras as menuExtras, toppings, ways, type WayId } from "@/data/menu";

export type Extra = {
  id: string;
  name: string;
  /** US dollars, same unit as `MenuItem.price`. */
  price: number;
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** `src/data/menu.ts`'s `extras`, with a stable slug id added to each. */
export const EXTRAS: Extra[] = menuExtras.map((e) => ({ ...e, id: slugify(e.name) }));

export function extraById(id: string): Extra | undefined {
  return EXTRAS.find((e) => e.id === id);
}

export function toppingById(id: string) {
  return toppings.find((t) => t.id === id);
}

/**
 * The topping ids a Way preset checks, read off `ways[].taps` (Otter's own
 * checkbox labels) rather than hand-duplicated, so a renamed or reordered
 * topping can't silently desync a preset from what it says it adds.
 *
 * A tap that matches no topping (there is none today) is dropped rather than
 * thrown, since a preset expansion is a best-effort convenience, not the
 * source of truth for what's in the cart line.
 */
function tapToToppingId(tap: string): string | undefined {
  const label = tap.replace(/^Add\s+/i, "").trim();
  // Strip everything but letters, then a trailing plural "s", so "Add Raw
  // Onion" (-> "rawonion") matches the topping named "Raw Onions"
  // (-> "rawonion") and "Add Sauce" (-> "sauce") matches inside "CNE Sauce"
  // (-> "cnesauce") via a substring check.
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z]/g, "")
      .replace(/s$/, "");
  const target = norm(label);
  const found = toppings.find((t) => {
    const name = norm(t.name);
    return name === target || name.includes(target);
  });
  return found?.id;
}

const WAY_TOPPING_IDS: Record<WayId, string[]> = Object.fromEntries(
  ways.map((w) => [w.id, w.taps.map(tapToToppingId).filter((id): id is string => Boolean(id))]),
) as Record<WayId, string[]>;

/** The topping ids a Way preset adds. */
export function toppingIdsForWay(wayId: WayId): string[] {
  return WAY_TOPPING_IDS[wayId] ?? [];
}

/**
 * Which Way (if any) a topping selection matches exactly, order ignored.
 * `null` when the selection is empty, `"custom"` when it matches neither
 * preset.
 */
export function resolveWay(toppingIds: string[]): WayId | "custom" | null {
  if (toppingIds.length === 0) return null;
  const sorted = [...toppingIds].sort();
  for (const way of ways) {
    const preset = [...toppingIdsForWay(way.id)].sort();
    if (preset.length === sorted.length && preset.every((id, i) => id === sorted[i])) {
      return way.id;
    }
  }
  return "custom";
}

export function wayLabel(wayId: WayId): string {
  return ways.find((w) => w.id === wayId)?.name ?? wayId;
}
