/**
 * Order numbers, quoting a cart, and reserving stock for a pending order
 * at checkout.
 *
 * Part of `@/lib/orders` (see `src/lib/orders.ts`), which re-exports the
 * public names; import from there, not from here.
 */
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { editions, orderItems, orders, variants } from "@/db/schema";
import { customerFacingProductName } from "@/lib/productName";
import {
  type Fulfilment,
  resolveDb,
  reservedQuantity,
  availableForRead,
  loadProductWithVariants,
  syncVariantAvailableMirror,
} from "./shared";
import { getStoreSettings, computeShippingCents } from "./settings";

// ---------------------------------------------------------------------------
// Order numbers
// ---------------------------------------------------------------------------

/** `nextval('order_number_seq')` formatted as `CNE-1001`. Safe under
 * concurrency — Postgres sequences never hand the same value to two callers. */
async function nextOrderNumber(db: Db): Promise<string> {
  const result = (await db.execute(sql`select nextval('order_number_seq') as n`)) as unknown as {
    rows: { n: string | number }[];
  };
  const row = result.rows[0];
  if (!row) throw new Error("nextval('order_number_seq') returned no row");
  return `CNE-${Number(row.n)}`;
}

// ---------------------------------------------------------------------------
// Quoting
// ---------------------------------------------------------------------------

export type QuoteLineError = {
  code: "unknown_product" | "not_published" | "over_limit" | "insufficient_stock";
  slug: string;
};

export type QuoteLine = {
  product: { id: string; slug: string; name: string };
  variantId: string;
  unitPriceCents: number;
  quantity: number;
  lineCents: number;
};

export type Quote = {
  lines: QuoteLine[];
  subtotalCents: number;
  shippingCents: number;
  currency: string;
};

/**
 * Sums quantities for repeated slugs into one line per product, in
 * first-seen order — defends `quoteCart`'s per-line `perOrderLimit` check
 * (and, by extension, `createPendingOrder`'s, which repeats the same
 * per-item validation under a lock) the same way the checkout route's own
 * body parsing does. Both merge independently: a caller of `quoteCart` that
 * isn't the checkout route (there is none today, but the type is public)
 * gets the same limit enforcement for free.
 */
function mergeDuplicateSlugs(
  items: { slug: string; quantity: number }[],
): { slug: string; quantity: number }[] {
  const order: string[] = [];
  const totals = new Map<string, number>();
  for (const item of items) {
    if (!totals.has(item.slug)) order.push(item.slug);
    totals.set(item.slug, (totals.get(item.slug) ?? 0) + item.quantity);
  }
  return order.map((slug) => ({ slug, quantity: totals.get(slug)! }));
}

/**
 * Prices a cart with no side effects and no locks — safe to call as often as
 * the checkout UI wants. `createPendingOrder` re-validates everything under
 * row locks before actually reserving anything, so a quote going stale
 * between this call and checkout can't oversell.
 */
export async function quoteCart(
  items: { slug: string; quantity: number }[],
  fulfilment: Fulfilment,
  db?: Db,
): Promise<Quote | QuoteLineError> {
  const database = await resolveDb(db);
  const now = new Date();
  const lines: QuoteLine[] = [];
  let subtotalCents = 0;
  const mergedItems = mergeDuplicateSlugs(items);

  for (const item of mergedItems) {
    const product = await loadProductWithVariants(database, item.slug);
    if (!product) return { code: "unknown_product", slug: item.slug };
    if (product.status !== "published") return { code: "not_published", slug: item.slug };
    if (item.quantity > product.perOrderLimit) return { code: "over_limit", slug: item.slug };

    const variant = product.variants[0];
    if (!variant) return { code: "insufficient_stock", slug: item.slug };

    const available = await availableForRead(database, variant, now);
    if (item.quantity > available) return { code: "insufficient_stock", slug: item.slug };

    const unitPriceCents = variant.priceCents ?? product.priceCents;
    const lineCents = unitPriceCents * item.quantity;
    subtotalCents += lineCents;

    lines.push({
      product: { id: product.id, slug: product.slug, name: product.name },
      variantId: variant.id,
      unitPriceCents,
      quantity: item.quantity,
      lineCents,
    });
  }

  const settings = await getStoreSettings(database);
  const shippingCents = computeShippingCents(fulfilment, subtotalCents, settings);

  return { lines, subtotalCents, shippingCents, currency: "usd" };
}

// ---------------------------------------------------------------------------
// Reservation
// ---------------------------------------------------------------------------

export type Reservation = {
  slug: string;
  variantId: string;
  quantity: number;
  /** The specific numbers locked for an edition product; empty for a
   * plain-quantity or untracked one. */
  editionNumbers: number[];
};

export type CreatePendingOrderInput = {
  items: { slug: string; quantity: number }[];
  fulfilment: Fulfilment;
  email?: string;
  holdMinutes?: number;
};

export type CreatePendingOrderResult = {
  orderId: string;
  number: string;
  reservations: Reservation[];
};

type PendingOrderItemRow = {
  productId: string;
  productName: string;
  variantId: string;
  sku: string;
  unitPriceCents: number;
  quantity: number;
};

/**
 * Reserves a cart for `holdMinutes` (default 30) in one transaction:
 * edition products lock and claim the lowest-numbered `available` editions
 * with `SELECT … FOR UPDATE SKIP LOCKED` (so a concurrent checkout never
 * sees a row this one is mid-claim on, and never blocks on it either — it
 * just moves on to the next available number); plain-quantity products lock
 * the variant row with `SELECT … FOR UPDATE` and check `inventory_quantity`
 * against other carts' live reservations. Fails the same validated way
 * `quoteCart` does (an unknown/unpublished slug, an over-limit quantity, or
 * — now under a real lock — insufficient stock), rolling back anything
 * already reserved earlier in the same cart.
 */
export async function createPendingOrder(
  input: CreatePendingOrderInput,
  db?: Db,
): Promise<CreatePendingOrderResult | QuoteLineError> {
  const database = await resolveDb(db);
  const holdMinutes = input.holdMinutes ?? 30;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + holdMinutes * 60_000);

  return database.transaction(async (tx) => {
    const reservations: Reservation[] = [];
    const itemRows: PendingOrderItemRow[] = [];
    const editionIdsByVariant = new Map<string, string[]>();
    let subtotalCents = 0;

    for (const item of input.items) {
      const product = await loadProductWithVariants(tx, item.slug);
      if (!product) return { code: "unknown_product", slug: item.slug };
      if (product.status !== "published") return { code: "not_published", slug: item.slug };
      if (item.quantity > product.perOrderLimit) return { code: "over_limit", slug: item.slug };

      const variant = product.variants[0];
      if (!variant) return { code: "insufficient_stock", slug: item.slug };

      const unitPriceCents = variant.priceCents ?? product.priceCents;
      subtotalCents += unitPriceCents * item.quantity;
      const editionNumbers: number[] = [];

      if (variant.editionSize !== null) {
        const locked = await tx
          .select({ id: editions.id, number: editions.number })
          .from(editions)
          .where(and(eq(editions.variantId, variant.id), eq(editions.status, "available")))
          .orderBy(asc(editions.number))
          .limit(item.quantity)
          .for("update", { skipLocked: true });

        if (locked.length < item.quantity) {
          return { code: "insufficient_stock", slug: item.slug };
        }

        editionIdsByVariant.set(variant.id, [
          ...(editionIdsByVariant.get(variant.id) ?? []),
          ...locked.map((e) => e.id),
        ]);

        // One order_item row per unit for an edition product, so each
        // number `markPaid` assigns lands on its own row.
        for (const e of locked) {
          editionNumbers.push(e.number);
          itemRows.push({
            productId: product.id,
            productName: customerFacingProductName(product),
            variantId: variant.id,
            sku: variant.sku,
            unitPriceCents,
            quantity: 1,
          });
        }
      } else if (variant.inventoryQuantity !== null) {
        const [lockedVariant] = await tx
          .select()
          .from(variants)
          .where(eq(variants.id, variant.id))
          .for("update");
        if (!lockedVariant) return { code: "insufficient_stock", slug: item.slug };

        const reserved = await reservedQuantity(tx, variant.id, now);
        const availableQty = (lockedVariant.inventoryQuantity ?? 0) - reserved;
        if (item.quantity > availableQty) {
          return { code: "insufficient_stock", slug: item.slug };
        }

        itemRows.push({
          productId: product.id,
          productName: customerFacingProductName(product),
          variantId: variant.id,
          sku: variant.sku,
          unitPriceCents,
          quantity: item.quantity,
        });
      } else {
        // Untracked: no stock constraint to lock or check.
        itemRows.push({
          productId: product.id,
          productName: customerFacingProductName(product),
          variantId: variant.id,
          sku: variant.sku,
          unitPriceCents,
          quantity: item.quantity,
        });
      }

      reservations.push({
        slug: item.slug,
        variantId: variant.id,
        quantity: item.quantity,
        editionNumbers,
      });
    }

    const settings = await getStoreSettings(tx);
    const shippingCents = computeShippingCents(input.fulfilment, subtotalCents, settings);
    const totalCents = subtotalCents + shippingCents;

    const number = await nextOrderNumber(tx);

    const [order] = await tx
      .insert(orders)
      .values({
        number,
        status: "pending",
        fulfilment: input.fulfilment,
        email: input.email ?? null,
        subtotalCents,
        shippingCents,
        taxCents: 0,
        totalCents,
        currency: "usd",
        expiresAt,
      })
      .returning();
    if (!order) throw new Error("insert of the order returned nothing");

    for (const row of itemRows) {
      await tx.insert(orderItems).values({ orderId: order.id, editionNumber: null, ...row });
    }

    for (const [variantId, editionIds] of editionIdsByVariant.entries()) {
      await tx
        .update(editions)
        .set({ status: "reserved", reservedUntil: expiresAt, orderId: order.id })
        .where(inArray(editions.id, editionIds));
      await syncVariantAvailableMirror(tx, variantId);
    }

    return { orderId: order.id, number: order.number, reservations };
  });
}

/** Attaches the Stripe Checkout Session id to a pending order, so the
 * webhook can find it again by session id alone. */
export async function attachStripeSession(
  orderId: string,
  sessionId: string,
  db?: Db,
): Promise<void> {
  const database = await resolveDb(db);
  await database
    .update(orders)
    .set({ stripeCheckoutSessionId: sessionId, updatedAt: new Date() })
    .where(eq(orders.id, orderId));
}

/**
 * Overwrites a pending order's hold expiry — used once the checkout route
 * knows the Stripe Checkout Session's own `expires_at`, so the two never
 * race: the order's hold is set to run a little *after* Stripe's session
 * expires, not roughly alongside it. A no-op on an order that isn't
 * `pending` (already paid or released — nothing to extend).
 */
export async function setOrderExpiry(orderId: string, at: Date, db?: Db): Promise<void> {
  const database = await resolveDb(db);
  await database
    .update(orders)
    .set({ expiresAt: at, updatedAt: new Date() })
    .where(and(eq(orders.id, orderId), eq(orders.status, "pending")));
}
