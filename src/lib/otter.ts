import type { MenuItem } from "@/data/menu";

/**
 * Otter Direct is the only ordering surface we have, and it exposes exactly one
 * useful hook: a URL that opens a single item with its add-to-cart sheet
 * already open. There is no way to prefill modifiers, and no way to hand it a
 * whole cart — so the site links one item at a time rather than pretending to
 * have a basket that would dead-end at the handoff.
 *
 * Shape (verified against the live storefront, 2026-09-08):
 *   https://order.tryotter.com/s/{slug}/{location}/{storeId}/{item name}/{itemId}
 */
export const otter = {
  slug: "chris-n-eddys",
  location: "5539-sunset-boulevard-los-angeles",
  storeId: "8c836303-8d5d-4c32-b9d1-a1ca5325b191",
} as const;

/** The storefront itself — the whole menu, no particular item. */
export const storeUrl = `https://order.tryotter.com/s/${otter.slug}/${otter.location}/${otter.storeId}`;

/**
 * Opens this exact item on Otter, ready to add.
 *
 * The item name is part of the path, so it has to match Otter's own spelling —
 * that is why `MenuItem.name` mirrors the storefront rather than being written
 * for the website.
 */
export function itemOrderUrl(item: Pick<MenuItem, "name" | "otterId">): string {
  return `${storeUrl}/${encodeURIComponent(item.name)}/${item.otterId}`;
}

/** Prices come from Otter as numbers; show them the way a menu should. */
export function formatPrice(price: number): string {
  return `$${price.toFixed(2)}`;
}
