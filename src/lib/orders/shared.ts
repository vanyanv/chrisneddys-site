/**
 * Types and stock helpers the order modules share: the order status and
 * fulfilment types, the test-env and database defaults, and the reads and
 * writes of a variant's stock that quoting, reserving, paying and releasing
 * all use.
 *
 * Part of `@/lib/orders` (see `src/lib/orders.ts`), which re-exports the
 * public names; import from there, not from here.
 */
import { and, eq, gt, sql } from "drizzle-orm";
import { getDb, type Db } from "@/db/client";
import { editions, orderItems, orders, variants } from "@/db/schema";

export type Fulfilment = "ship" | "pickup";
export type OrderStatus =
  | "pending"
  | "paid"
  | "fulfilled"
  | "ready_for_pickup"
  | "picked_up"
  | "refunded"
  | "cancelled";

type VariantWithEditions = typeof variants.$inferSelect & {
  editions: (typeof editions.$inferSelect)[];
};
type ProductWithVariants = {
  id: string;
  slug: string;
  name: string;
  status: "draft" | "published" | "archived";
  priceCents: number;
  perOrderLimit: number;
  variants: VariantWithEditions[];
};

export function isTestEnv(): boolean {
  return process.env.VITEST === "true" || process.env.NODE_ENV === "test";
}

export async function resolveDb(db: Db | undefined): Promise<Db> {
  return db ?? (await getDb());
}

/** Sum of `order_items.quantity` across this variant's still-live pending
 * reservations — what a plain-quantity product's `inventory_quantity` has
 * already promised to someone else's cart. */
export async function reservedQuantity(db: Db, variantId: string, now: Date): Promise<number> {
  const [row] = await db
    .select({ reserved: sql<number>`coalesce(sum(${orderItems.quantity}), 0)::int` })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(
      and(
        eq(orderItems.variantId, variantId),
        eq(orders.status, "pending"),
        gt(orders.expiresAt, now),
      ),
    );
  return row?.reserved ?? 0;
}

/** How many units of `variant` a new cart could still claim right now — the
 * count of `available` editions for an edition product, `inventory_quantity`
 * minus other carts' live reservations for a quantity product, or unbounded
 * for an untracked one. Read-only (no locks) — `quoteCart`'s use only. */
export async function availableForRead(
  db: Db,
  variant: VariantWithEditions,
  now: Date,
): Promise<number> {
  if (variant.editionSize !== null) {
    return variant.editions.filter((e) => e.status === "available").length;
  }
  if (variant.inventoryQuantity !== null) {
    return variant.inventoryQuantity - (await reservedQuantity(db, variant.id, now));
  }
  return Number.POSITIVE_INFINITY;
}

export async function loadProductWithVariants(
  db: Db,
  slug: string,
): Promise<ProductWithVariants | undefined> {
  return db.query.products.findFirst({
    where: (p, { eq }) => eq(p.slug, slug),
    with: { variants: { with: { editions: true } } },
  });
}

/** Recomputes `variants.inventory_quantity` for an edition product from the
 * actual count of `available` editions, so `getInventory`'s reading of that
 * column never drifts from the rows that back it. */
export async function syncVariantAvailableMirror(tx: Db, variantId: string): Promise<void> {
  const [row] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(editions)
    .where(and(eq(editions.variantId, variantId), eq(editions.status, "available")));
  await tx
    .update(variants)
    .set({ inventoryQuantity: row?.count ?? 0, updatedAt: new Date() })
    .where(eq(variants.id, variantId));
}
