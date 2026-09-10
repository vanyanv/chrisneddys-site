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

/**
 * The storefront itself — the whole menu, no particular item.
 *
 * Deliberately untagged. This is the URL that stands for the storefront as a
 * thing in the world, so it is what `sameAs` and `OrderAction` point at; a
 * campaign parameter in structured data would be claiming that the storefront's
 * identity includes where a particular visitor came from.
 *
 * Links people actually click go through `orderUrl` instead.
 */
export const storeUrl = `https://order.tryotter.com/s/${otter.slug}/${otter.location}/${otter.storeId}`;

/**
 * Where a click came from, in the vocabulary Otter's own reporting will show.
 *
 * These end up in `utm_campaign`, so they are the only handle anyone has for
 * asking "did the sticky dock earn its place on the screen". Keep them stable —
 * renaming one splits its history in two.
 */
export type OrderSurface =
  | "hero"
  | "dock"
  | "header"
  | "nav"
  | "menu-item"
  | "item-sheet"
  | "order-page"
  | "location-card"
  | "location-page"
  | "locations-map";

/**
 * Tags an outbound order link so the order it produces can be traced back here.
 *
 * Without this the site is invisible in Otter's reporting: a website order and
 * a walk-in who scanned the counter QR arrive looking identical. Verified
 * against the live storefront on 2026-09-09 — Otter ignores the extra query
 * parameters and still opens the right store and the right item.
 */
export function withUtm(url: string, surface: OrderSurface): string {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}utm_source=site&utm_medium=referral&utm_campaign=${surface}`;
}

/** The storefront, tagged with the surface that sent the visitor. */
export function orderUrl(surface: OrderSurface): string {
  return withUtm(storeUrl, surface);
}

/**
 * Opens this exact item on Otter, ready to add.
 *
 * The item name is part of the path, so it has to match Otter's own spelling —
 * that is why `MenuItem.name` mirrors the storefront rather than being written
 * for the website.
 */
export function itemOrderUrl(
  item: Pick<MenuItem, "name" | "otterId">,
  surface?: OrderSurface,
): string {
  const url = `${storeUrl}/${encodeURIComponent(item.name)}/${item.otterId}`;
  // Untagged by default, because the caller with no surface to declare is the
  // JSON-LD builder, and an `Offer.url` should name the offer, not a campaign.
  return surface ? withUtm(url, surface) : url;
}

/**
 * Alt text for an item's photograph.
 *
 * Derived rather than authored so it cannot drift from the menu the way the
 * hero's price did. The description is already a plain account of what is in
 * the picture — two patties, two slices of cheese, a buttered roll — which is
 * exactly what alt text is for, and what image search reads.
 */
export function itemPhotoAlt(item: Pick<MenuItem, "name" | "desc">): string {
  return item.desc ? `${item.name} — ${item.desc}` : `${item.name} from Chris N Eddy's`;
}

/** Prices come from Otter as numbers; show them the way a menu should. */
export function formatPrice(price: number): string {
  return `$${price.toFixed(2)}`;
}
