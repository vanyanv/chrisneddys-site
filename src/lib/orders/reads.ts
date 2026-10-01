/**
 * Reading orders back: by id, Stripe session or payment intent, number and
 * email, the admin list, and the checkout route's per-product limits and
 * edition sizes.
 *
 * Part of `@/lib/orders` (see `src/lib/orders.ts`), which re-exports the
 * public names; import from there, not from here.
 */
import { and, desc, eq, inArray, lt, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { orderItems, orders, products, variants } from "@/db/schema";
import { type OrderStatus, resolveDb, availableForRead, loadProductWithVariants } from "./shared";

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export type OrderWithItems = typeof orders.$inferSelect & {
  items: (typeof orderItems.$inferSelect & { product: typeof products.$inferSelect })[];
};

export async function getOrder(id: string, db?: Db): Promise<OrderWithItems | undefined> {
  const database = await resolveDb(db);
  return database.query.orders.findFirst({
    where: eq(orders.id, id),
    with: { items: { with: { product: true } } },
  });
}

export async function getOrderBySessionId(
  sessionId: string,
  db?: Db,
): Promise<OrderWithItems | undefined> {
  const database = await resolveDb(db);
  return database.query.orders.findFirst({
    where: eq(orders.stripeCheckoutSessionId, sessionId),
    with: { items: { with: { product: true } } },
  });
}

/** Case-insensitive on email, for the "look up my order" customer page. */
export async function getOrderByNumberAndEmail(
  number: string,
  email: string,
  db?: Db,
): Promise<OrderWithItems | undefined> {
  const database = await resolveDb(db);
  return database.query.orders.findFirst({
    where: and(eq(orders.number, number), sql`lower(${orders.email}) = lower(${email})`),
    with: { items: { with: { product: true } } },
  });
}

export type ListOrdersInput = { status?: OrderStatus; limit?: number; cursor?: string };
export type ListOrdersResult = {
  orders: (typeof orders.$inferSelect)[];
  nextCursor: string | null;
};

/** Newest-first, keyset-paginated by `created_at` (cursor = the last row's
 * id from the previous page). */
export async function listOrders(input: ListOrdersInput = {}, db?: Db): Promise<ListOrdersResult> {
  const database = await resolveDb(db);
  const limit = input.limit ?? 50;

  let cursorCreatedAt: Date | undefined;
  if (input.cursor) {
    const cursorRow = await database.query.orders.findFirst({ where: eq(orders.id, input.cursor) });
    cursorCreatedAt = cursorRow?.createdAt;
  }

  const conditions = [];
  if (input.status) conditions.push(eq(orders.status, input.status));
  if (cursorCreatedAt) conditions.push(lt(orders.createdAt, cursorCreatedAt));

  const rows = await database
    .select()
    .from(orders)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(orders.createdAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];
  return { orders: page, nextCursor: hasMore && last ? last.id : null };
}

// ---------------------------------------------------------------------------
// Checkout-route helpers
// ---------------------------------------------------------------------------

/**
 * Read-only, no locks: a product's per-order cap and how many units are
 * still claimable right now — what the checkout route turns a
 * `QuoteLineError` into a human message with ("Only 2 per order.", "Only 1
 * left."). Small helper added for that one call site rather than exposing
 * `perOrderLimit` on the public `MerchProduct` shape.
 */
export async function getProductLimits(
  slug: string,
  db?: Db,
): Promise<{ perOrderLimit: number; available: number } | undefined> {
  const database = await resolveDb(db);
  const product = await loadProductWithVariants(database, slug);
  if (!product) return undefined;
  const variant = product.variants[0];
  const available = variant ? await availableForRead(database, variant, new Date()) : 0;
  return { perOrderLimit: product.perOrderLimit, available };
}

/**
 * Edition size per variant id, for a "#37 of 50" line — not stored on
 * `order_items` itself (an edition's size lives on the variant), so the
 * email templates and the thanks/order-lookup pages share this one lookup
 * rather than each re-deriving it.
 */
export async function getEditionSizes(
  variantIds: string[],
  db?: Db,
): Promise<Map<string, number | null>> {
  const database = await resolveDb(db);
  const ids = [...new Set(variantIds)];
  if (ids.length === 0) return new Map();
  const rows = await database
    .select({ id: variants.id, editionSize: variants.editionSize })
    .from(variants)
    .where(inArray(variants.id, ids));
  return new Map(rows.map((r) => [r.id, r.editionSize]));
}

/** By Stripe PaymentIntent id — `charge.refunded` carries the intent, not
 * the Checkout Session id `markPaid`/`releaseOrder` otherwise key off. */
export async function getOrderByPaymentIntentId(
  paymentIntentId: string,
  db?: Db,
): Promise<OrderWithItems | undefined> {
  const database = await resolveDb(db);
  return database.query.orders.findFirst({
    where: eq(orders.stripePaymentIntentId, paymentIntentId),
    with: { items: { with: { product: true } } },
  });
}
