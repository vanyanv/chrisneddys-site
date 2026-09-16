/**
 * The one name a customer should ever see for a product.
 *
 * `products` carries two of them. `name` is the original internal field,
 * set once by `createDraft`. `displayName1`/`displayName2` are the two
 * lines the shop actually renders and the only ones The Rack's panel
 * writes to — "New product" creates a draft with an EMPTY `name` and never
 * fills it in, so for anything created in the current admin `name` stays
 * blank for good.
 *
 * That matters well beyond display, because `orders.ts` snapshots a name
 * onto every `order_items` row at checkout so later edits can't rewrite
 * history. Snapshotting `product.name` recorded an empty string for any
 * Rack-created product, and an order that does not say what was bought is
 * a broken receipt, a broken packing slip and a broken order-status page
 * at once (issue #41).
 *
 * Prefers the display lines, falls back to `name` for the seeded products
 * that have one, and only then to a last-resort label — a snapshot has to
 * put something on the row, unlike the admin's own `productTitle`, which
 * returns "" so an unnamed draft can be shown honestly as unnamed.
 */
export function customerFacingProductName(product: {
  displayName1?: string | null;
  displayName2?: string | null;
  name?: string | null;
}): string {
  const display = [product.displayName1, product.displayName2]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join(" ");
  if (display) return display;

  const legacy = (product.name ?? "").trim();
  if (legacy) return legacy;

  return "Untitled product";
}
