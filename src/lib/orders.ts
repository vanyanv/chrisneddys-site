/**
 * The order + reservation layer. Every write here happens inside a
 * `db.transaction`, and every row that two concurrent checkouts could race
 * over (an edition, a variant's stock) is locked with `SELECT … FOR UPDATE`
 * before it is read — `FOR UPDATE SKIP LOCKED` for editions, so one buyer's
 * in-flight reservation never blocks another buyer's pick of a *different*
 * available number, only ever gives them a different one.
 *
 * Callers: the checkout route (`createPendingOrder`, `attachStripeSession`)
 * and the Stripe webhook (`markPaid`, `releaseOrder`, `recordStripeEvent` /
 * `markStripeEventProcessed`). Admin pages read through `listOrders` /
 * `getOrder` / `setFulfilment` and friends; the customer lookup page through
 * `getOrderByNumberAndEmail`.
 *
 * Every export takes an optional `db: Db` as its last parameter (default
 * `getDb()`) so tests can pass a PGlite instance instead of talking to Neon.
 */
import { and, asc, desc, eq, gt, inArray, lt, sql } from "drizzle-orm";
import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import { cache } from "react";
import { getDb, type Db } from "@/db/client";
import {
  editions,
  orderItems,
  orders,
  storeSettings,
  stripeEvents,
  variants,
  type ShipTo,
} from "@/db/schema";
import { customerFacingProductName } from "@/lib/productName";

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

function isTestEnv(): boolean {
  return process.env.VITEST === "true" || process.env.NODE_ENV === "test";
}

async function resolveDb(db: Db | undefined): Promise<Db> {
  return db ?? (await getDb());
}

/**
 * `revalidateTag("catalogue")` + `revalidatePath` for the storefront pages a
 * mutation could have changed — the same responsibility `catalogAdmin.ts`'s
 * callers carry today, packaged here so the checkout route and the Stripe
 * webhook don't have to import `next/cache` themselves. No-op under Vitest,
 * where there is no request/render context for `next/cache` to act on.
 */
export function catalogueChanged(slugs: string[] = []): void {
  if (isTestEnv()) return;
  revalidateTag("catalogue");
  revalidatePath("/shop/");
  for (const slug of slugs) revalidatePath(`/shop/${slug}/`);
}

// ---------------------------------------------------------------------------
// Store settings
// ---------------------------------------------------------------------------

export type StoreSettings = typeof storeSettings.$inferSelect;

/** Reads the single `store_settings` row, creating a bare-default one on the
 * (in practice, seed-only) chance it doesn't exist yet. */
export async function getStoreSettings(db?: Db): Promise<StoreSettings> {
  const database = await resolveDb(db);
  const existing = await database.query.storeSettings.findFirst({
    where: eq(storeSettings.id, "default"),
  });
  if (existing) return existing;

  const [created] = await database
    .insert(storeSettings)
    .values({ id: "default", storeName: "Store", supportEmail: "support@example.com" })
    .onConflictDoNothing({ target: storeSettings.id })
    .returning();
  if (created) return created;

  // Someone else created it between the read and the insert above.
  const row = await database.query.storeSettings.findFirst({
    where: eq(storeSettings.id, "default"),
  });
  if (!row) throw new Error("store_settings default row missing and could not be created");
  return row;
}

/** Matches the `revalidate = 60` the storefront pages that read these
 * settings already declare, and `src/lib/catalog.ts`'s own window. */
const REVALIDATE_SECONDS = 60;

/** Tag for the cached storefront settings read below. Every write to
 * `store_settings` has to clear it — see `saveStoreSettings`. */
export const STORE_SETTINGS_TAG = "store-settings";

const cachedStoreSettings = unstable_cache(() => getStoreSettings(), ["store-settings"], {
  tags: [STORE_SETTINGS_TAG],
  revalidate: REVALIDATE_SECONDS,
});

/**
 * `unstable_cache` stores what it caches as JSON, so a `timestamp` column
 * comes back out of it as an ISO string rather than the `Date` the row type
 * promises. `/returns/` and `/terms/` both call `updatedAt.toISOString()` to
 * stamp their "last updated" line, and a string has no such method — this is
 * what a cached settings read has to put back before handing the row on.
 */
export function reviveStoreSettings(row: StoreSettings): StoreSettings {
  return { ...row, updatedAt: new Date(row.updatedAt) };
}

/**
 * The storefront's read of `store_settings` — the store name, the shipping
 * and returns copy, and whether the shop is open.
 *
 * `getStoreSettings` above goes to the database every single time it is
 * called, which is right for checkout, the Stripe webhook and `/admin` (all
 * of which must never act on a stale row) but wrong for rendering a page:
 * `src/app/(site)/layout.tsx` calls it on *every* storefront page and the
 * page underneath then calls it again, so a page whose product data was
 * entirely cached still made two database round trips before it could
 * render. This is that same read, cached for a minute the way
 * `src/lib/catalog.ts` caches the catalogue, and wrapped in React's `cache`
 * so the layout and the page share one call within a single render instead
 * of two.
 *
 * Owners never wait the minute out: `saveStoreSettings` clears
 * `STORE_SETTINGS_TAG` on every save, so a change is live on the storefront
 * as soon as it is saved. Anything that must read the row as it stands right
 * now — checkout's open/paused gate, the admin's own screens — keeps calling
 * `getStoreSettings` directly.
 */
export const getPublicStoreSettings = cache(async (): Promise<StoreSettings> => {
  if (isTestEnv()) return getStoreSettings();
  return reviveStoreSettings(await cachedStoreSettings());
});

export type StoreSettingsPatch = Partial<{
  storeName: string;
  supportEmail: string;
  pickupEnabled: boolean;
  pickupAddress: string;
  shippingFlatCents: number;
  shippingFreeOverCents: number | null;
  shipCountries: string[];
  returnsPolicy: string | null;
  termsText: string | null;
  shipsWithin: string | null;
  shopPaused: boolean;
  pauseNote: string | null;
}>;

export type UpdateStoreSettingsResult =
  | { ok: true; settings: StoreSettings }
  | { ok: false; error: string; field?: keyof StoreSettingsPatch };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COUNTRY_PATTERN = /^[A-Z]{2}$/;

/** Long enough for "Back Thursday" or a sentence, short enough that it
 * can't turn into a second returns policy pasted into the wrong field. */
const PAUSE_NOTE_MAX_LENGTH = 140;

/** Long enough for "5-7 business days", short enough that it can't turn
 * into a second sentence folded into `shopCopy.ts`'s one-line shipping
 * clause ("Ships within {this}."). */
const SHIPS_WITHIN_MAX_LENGTH = 60;

function isNonNegativeInt(n: number): boolean {
  return Number.isInteger(n) && n >= 0;
}

/** Validates `patch`, then merges it into the single `store_settings` row. */
export async function updateStoreSettings(
  patch: StoreSettingsPatch,
  db?: Db,
): Promise<UpdateStoreSettingsResult> {
  const database = await resolveDb(db);

  if (patch.supportEmail !== undefined && !EMAIL_PATTERN.test(patch.supportEmail)) {
    return { ok: false, error: "Support email is not a valid email address." };
  }
  if (patch.shippingFlatCents !== undefined && !isNonNegativeInt(patch.shippingFlatCents)) {
    return { ok: false, error: "Flat shipping rate must be a non-negative whole number of cents." };
  }
  if (
    patch.shippingFreeOverCents !== undefined &&
    patch.shippingFreeOverCents !== null &&
    !isNonNegativeInt(patch.shippingFreeOverCents)
  ) {
    return {
      ok: false,
      error: "Free-shipping threshold must be a non-negative whole number of cents.",
    };
  }
  if (patch.shipCountries !== undefined) {
    const bad = patch.shipCountries.find((c) => !COUNTRY_PATTERN.test(c));
    if (bad !== undefined) {
      return { ok: false, error: `"${bad}" is not an uppercase ISO-2 country code.` };
    }
  }
  if (
    patch.pauseNote !== undefined &&
    patch.pauseNote !== null &&
    patch.pauseNote.length > PAUSE_NOTE_MAX_LENGTH
  ) {
    return {
      ok: false,
      error: `Keep the pause note under ${PAUSE_NOTE_MAX_LENGTH} characters.`,
      field: "pauseNote",
    };
  }
  if (
    patch.shipsWithin !== undefined &&
    patch.shipsWithin !== null &&
    patch.shipsWithin.length > SHIPS_WITHIN_MAX_LENGTH
  ) {
    return {
      ok: false,
      error: `Keep "Ships within" under ${SHIPS_WITHIN_MAX_LENGTH} characters.`,
      field: "shipsWithin",
    };
  }

  // Also ensures the row exists before the update below.
  const current = await getStoreSettings(database);

  // A pickup counter with no address is not a real pickup option — checked
  // against the *effective* patch (what the row would read after this
  // write), so blanking the address while pickup is already on is caught
  // exactly the same as flipping pickup on over an address that's already
  // blank.
  const effectivePickupEnabled = patch.pickupEnabled ?? current.pickupEnabled;
  const effectivePickupAddress = (patch.pickupAddress ?? current.pickupAddress).trim();
  if (effectivePickupEnabled && !effectivePickupAddress) {
    return {
      ok: false,
      error: "Add the pickup address, or turn pickup off.",
      field: "pickupAddress",
    };
  }

  const [row] = await database
    .update(storeSettings)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(storeSettings.id, "default"))
    .returning();
  if (!row) throw new Error("update of store_settings returned nothing");
  return { ok: true, settings: row };
}

function computeShippingCents(
  fulfilment: Fulfilment,
  subtotalCents: number,
  settings: StoreSettings,
): number {
  if (fulfilment === "pickup") return 0;
  if (settings.shippingFreeOverCents !== null && subtotalCents >= settings.shippingFreeOverCents) {
    return 0;
  }
  return settings.shippingFlatCents;
}

// ---------------------------------------------------------------------------
// Order numbers
// ---------------------------------------------------------------------------

/** `nextval('order_number_seq')` formatted as `CNE-1001`. Safe under
 * concurrency — Postgres sequences never hand the same value to two callers. */
export async function nextOrderNumber(db: Db): Promise<string> {
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

/** Sum of `order_items.quantity` across this variant's still-live pending
 * reservations — what a plain-quantity product's `inventory_quantity` has
 * already promised to someone else's cart. */
async function reservedQuantity(db: Db, variantId: string, now: Date): Promise<number> {
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
async function availableForRead(db: Db, variant: VariantWithEditions, now: Date): Promise<number> {
  if (variant.editionSize !== null) {
    return variant.editions.filter((e) => e.status === "available").length;
  }
  if (variant.inventoryQuantity !== null) {
    return variant.inventoryQuantity - (await reservedQuantity(db, variant.id, now));
  }
  return Number.POSITIVE_INFINITY;
}

async function loadProductWithVariants(
  db: Db,
  slug: string,
): Promise<ProductWithVariants | undefined> {
  return db.query.products.findFirst({
    where: (p, { eq }) => eq(p.slug, slug),
    with: { variants: { with: { editions: true } } },
  });
}

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

/** Recomputes `variants.inventory_quantity` for an edition product from the
 * actual count of `available` editions, so `getInventory`'s reading of that
 * column never drifts from the rows that back it. */
async function syncVariantAvailableMirror(tx: Db, variantId: string): Promise<void> {
  const [row] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(editions)
    .where(and(eq(editions.variantId, variantId), eq(editions.status, "available")));
  await tx
    .update(variants)
    .set({ inventoryQuantity: row?.count ?? 0, updatedAt: new Date() })
    .where(eq(variants.id, variantId));
}

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

// ---------------------------------------------------------------------------
// Payment
// ---------------------------------------------------------------------------

export type MarkPaidInput = {
  orderId?: string;
  sessionId?: string;
  paymentIntentId: string;
  email: string;
  name: string;
  phone?: string | null;
  shipTo?: ShipTo | null;
  amounts: { subtotal: number; shipping: number; tax: number; total: number };
  paidAt?: Date;
};

export type MarkPaidResultItem = {
  id: string;
  variantId: string;
  quantity: number;
  editionNumber: number | null;
};

export type MarkPaidResult = {
  orderId: string;
  number: string;
  items: MarkPaidResultItem[];
};

function toMarkPaidResult(
  order: { id: string; number: string },
  items: (typeof orderItems.$inferSelect)[],
): MarkPaidResult {
  return {
    orderId: order.id,
    number: order.number,
    items: items.map((i) => ({
      id: i.id,
      variantId: i.variantId,
      quantity: i.quantity,
      editionNumber: i.editionNumber,
    })),
  };
}

const PAID_AFTER_RELEASE_NOTE = "PAID AFTER RELEASE — NO STOCK LEFT — REFUND IN STRIPE";

/**
 * Flips an order to paid: reserved editions become `sold` (and their
 * numbers land on the matching `order_items.edition_number`), plain-quantity
 * variants decrement `inventory_quantity` by the paid quantity — the only
 * point that column drops for those products, per the "decrement only on
 * payment" rule. Idempotent: a second call for an already-paid order just
 * re-reads and returns the same result, no double decrement.
 *
 * Tolerates an order that has already been `cancelled` (its hold released —
 * by `releaseExpiredReservations`, or the webhook's own
 * `checkout.session.expired`/`async_payment_failed` handling) by the time
 * Stripe confirms the payment: a customer paying in the last seconds before
 * the hold's `expiresAt` can still land here after the release ran. Rather
 * than throwing forever (the order would never get marked paid, so the desk
 * would never see money that Stripe actually collected), it re-reserves on
 * the spot — preferring the exact edition numbers this order held before
 * (still findable by `editions.order_id`, as long as nothing else has
 * claimed them since released editions go back into the ordinary
 * `available` pool) and falling back to the next lowest-numbered available
 * ones. If stock genuinely ran out in between, the order is still marked
 * paid (Stripe already has the customer's money — that can't be undone
 * here), but `notes` gets `PAID_AFTER_RELEASE_NOTE` so the desk flags it for
 * a manual Stripe refund, and the shortfall is logged.
 */
export async function markPaid(input: MarkPaidInput, db?: Db): Promise<MarkPaidResult> {
  const database = await resolveDb(db);

  return database.transaction(async (tx) => {
    const order = input.orderId
      ? await tx.query.orders.findFirst({ where: eq(orders.id, input.orderId) })
      : input.sessionId
        ? await tx.query.orders.findFirst({
            where: eq(orders.stripeCheckoutSessionId, input.sessionId),
          })
        : undefined;
    if (!order) throw new Error("markPaid: order not found");

    if (order.status === "paid") {
      const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, order.id));
      return toMarkPaidResult(order, items);
    }

    const wasReleased = order.status === "cancelled";
    if (order.status !== "pending" && !wasReleased) {
      throw new Error(`markPaid: order ${order.number} is not pending (status: ${order.status})`);
    }

    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, order.id));
    const byVariant = new Map<string, (typeof orderItems.$inferSelect)[]>();
    for (const item of items) {
      byVariant.set(item.variantId, [...(byVariant.get(item.variantId) ?? []), item]);
    }

    let outOfStock = false;

    for (const [variantId, variantItems] of byVariant.entries()) {
      const variant = await tx.query.variants.findFirst({ where: eq(variants.id, variantId) });
      if (!variant) continue;

      if (variant.editionSize !== null) {
        const unassignedItems = variantItems.filter((i) => i.editionNumber === null);
        const needed = unassignedItems.length;

        let claimed: { id: string; number: number }[];
        if (!wasReleased) {
          claimed = await tx
            .select({ id: editions.id, number: editions.number })
            .from(editions)
            .where(
              and(
                eq(editions.orderId, order.id),
                eq(editions.variantId, variantId),
                eq(editions.status, "reserved"),
              ),
            )
            .orderBy(asc(editions.number));
        } else {
          // Prefer this order's own previously-reserved numbers, still
          // sitting `available` (nobody else claimed them in between).
          const sameNumbers = await tx
            .select({ id: editions.id, number: editions.number })
            .from(editions)
            .where(
              and(
                eq(editions.variantId, variantId),
                eq(editions.orderId, order.id),
                eq(editions.status, "available"),
              ),
            )
            .orderBy(asc(editions.number))
            .limit(needed)
            .for("update", { skipLocked: true });

          claimed = [...sameNumbers];
          const stillNeeded = needed - claimed.length;
          if (stillNeeded > 0) {
            const claimedIds = new Set(claimed.map((e) => e.id));
            const candidates = await tx
              .select({ id: editions.id, number: editions.number })
              .from(editions)
              .where(and(eq(editions.variantId, variantId), eq(editions.status, "available")))
              .orderBy(asc(editions.number))
              .limit(stillNeeded + claimedIds.size)
              .for("update", { skipLocked: true });
            for (const candidate of candidates) {
              if (claimed.length >= needed) break;
              if (claimedIds.has(candidate.id)) continue;
              claimed.push(candidate);
            }
          }
        }

        const pairCount = Math.min(claimed.length, unassignedItems.length);
        for (let i = 0; i < pairCount; i++) {
          const edition = claimed[i]!;
          const item = unassignedItems[i]!;
          await tx
            .update(editions)
            .set({ status: "sold", reservedUntil: null, orderId: order.id })
            .where(eq(editions.id, edition.id));
          await tx
            .update(orderItems)
            .set({ editionNumber: edition.number, updatedAt: new Date() })
            .where(eq(orderItems.id, item.id));
        }
        if (pairCount < needed) outOfStock = true;

        await syncVariantAvailableMirror(tx, variantId);
      } else if (variant.inventoryQuantity !== null) {
        const totalQuantity = variantItems.reduce((sum, i) => sum + i.quantity, 0);
        if (!wasReleased) {
          await tx
            .update(variants)
            .set({
              inventoryQuantity: sql`${variants.inventoryQuantity} - ${totalQuantity}`,
              updatedAt: new Date(),
            })
            .where(eq(variants.id, variantId));
        } else {
          const [lockedVariant] = await tx
            .select()
            .from(variants)
            .where(eq(variants.id, variantId))
            .for("update");
          const available = lockedVariant?.inventoryQuantity ?? 0;
          const decrement = Math.min(available, totalQuantity);
          if (decrement < totalQuantity) outOfStock = true;
          await tx
            .update(variants)
            .set({
              inventoryQuantity: sql`${variants.inventoryQuantity} - ${decrement}`,
              updatedAt: new Date(),
            })
            .where(eq(variants.id, variantId));
        }
      }
    }

    if (outOfStock) {
      console.error(
        `markPaid: order ${order.number} was paid after its hold was released and ran out of ` +
          "stock reclaiming it — flagged on the order for a manual refund.",
      );
    }

    const paidAt = input.paidAt ?? new Date();
    await tx
      .update(orders)
      .set({
        status: "paid",
        email: input.email,
        name: input.name,
        phone: input.phone ?? null,
        shipTo: input.shipTo ?? null,
        subtotalCents: input.amounts.subtotal,
        shippingCents: input.amounts.shipping,
        taxCents: input.amounts.tax,
        totalCents: input.amounts.total,
        stripePaymentIntentId: input.paymentIntentId,
        paidAt,
        expiresAt: null,
        notes: outOfStock ? PAID_AFTER_RELEASE_NOTE : order.notes,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, order.id));

    const finalItems = await tx.select().from(orderItems).where(eq(orderItems.orderId, order.id));
    return toMarkPaidResult(order, finalItems);
  });
}

// ---------------------------------------------------------------------------
// Release
// ---------------------------------------------------------------------------

export type OrderIdentifier = { orderId?: string; sessionId?: string };

/**
 * Returns a pending order's reserved editions to the pool and cancels it.
 * Idempotent and a no-op on anything not currently `pending` (already
 * released, already paid, not found) — returns whether it actually released
 * something.
 */
export async function releaseOrder(
  identifier: OrderIdentifier,
  reason: "expired" | "cancelled",
  db?: Db,
): Promise<boolean> {
  const database = await resolveDb(db);

  return database.transaction(async (tx) => {
    const order = identifier.orderId
      ? await tx.query.orders.findFirst({ where: eq(orders.id, identifier.orderId) })
      : identifier.sessionId
        ? await tx.query.orders.findFirst({
            where: eq(orders.stripeCheckoutSessionId, identifier.sessionId),
          })
        : undefined;
    if (!order) return false;
    if (order.status !== "pending") return false;

    const reserved = await tx.select().from(editions).where(eq(editions.orderId, order.id));
    const touchedVariants = new Set(reserved.map((e) => e.variantId));

    if (reserved.length > 0) {
      // `order_id` is deliberately *not* cleared here (only `status` and
      // `reserved_until` are): a fresh reservation only ever looks at
      // `status = 'available'`, never at who last held a number, so this
      // is harmless for the ordinary claim path — but it lets `markPaid`
      // recognize and prefer these exact numbers if this same order's
      // payment lands after the release (see `markPaid`'s `wasReleased`
      // branch). The next order to actually reserve this edition
      // overwrites `order_id` to its own id, same as always.
      await tx
        .update(editions)
        .set({ status: "available", reservedUntil: null })
        .where(eq(editions.orderId, order.id));
    }
    for (const variantId of touchedVariants) {
      await syncVariantAvailableMirror(tx, variantId);
    }

    await tx
      .update(orders)
      .set({
        status: "cancelled",
        notes: order.notes ?? reason,
        expiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, order.id));

    return true;
  });
}

/**
 * Releases every pending order whose hold has expired. Call opportunistically
 * before a new reservation, or from a cron. Returns how many were released.
 *
 * This runs on the buy button, in front of a shopper, because it has to:
 * `createPendingOrder` claims editions by `status = 'available'`, so a lapsed
 * hold whose numbers are still marked `reserved` reads as sold-out stock
 * until something puts them back. (Plain-quantity products don't need it —
 * `reservedQuantity` already discounts holds whose `expires_at` has passed
 * in SQL — but edition products do, because `editions.status` is a
 * materialized state rather than a derived one.)
 *
 * What it must not do is bill one shopper for everyone else's cleanup. It
 * used to run `releaseOrder` in a loop, one transaction each, so the cost of
 * clicking Buy scaled with however many holds happened to have lapsed — and
 * they lapse in bursts, thirty minutes after a drop, which is exactly when
 * the next person is clicking. It is now a single transaction whose
 * statement count is bounded by the number of variants touched instead: two
 * statements plus a mirror resync per variant, whether one hold expired or
 * two hundred.
 *
 * Two guards make a batch safe where the loop relied on re-reading each
 * order: only editions still `reserved` go back (one the webhook has already
 * sold is never handed to somebody else), and only orders still `pending`
 * are cancelled (a payment that lands mid-sweep is not overwritten). Neither
 * takes a lock on `orders` before the one on `editions`: `markPaid` locks
 * editions first and updates the order last, and taking them the other way
 * round here is how the two would deadlock.
 */
export async function releaseExpiredReservations(now: Date = new Date(), db?: Db): Promise<number> {
  const database = await resolveDb(db);

  return database.transaction(async (tx) => {
    const expired = await tx
      .select({ id: orders.id })
      .from(orders)
      .where(and(eq(orders.status, "pending"), lt(orders.expiresAt, now)));
    if (expired.length === 0) return 0;

    const ids = expired.map((row) => row.id);

    // Every held number goes back in one statement. `order_id` is
    // deliberately left set, exactly as `releaseOrder` leaves it and for the
    // same reason: `markPaid`'s `wasReleased` branch uses it to reclaim these
    // precise numbers if this order's payment lands after its hold lapsed.
    const freed = await tx
      .update(editions)
      .set({ status: "available", reservedUntil: null })
      .where(and(inArray(editions.orderId, ids), eq(editions.status, "reserved")))
      .returning({ variantId: editions.variantId });

    // Bounded by how many variants were actually touched — at most the size
    // of the catalogue — rather than by how many orders expired.
    for (const variantId of new Set(freed.map((row) => row.variantId))) {
      await syncVariantAvailableMirror(tx, variantId);
    }

    // `coalesce` is `releaseOrder`'s `order.notes ?? reason` in SQL: a note
    // someone already wrote on the order survives, and only an unset one
    // becomes "expired".
    const released = await tx
      .update(orders)
      .set({
        status: "cancelled",
        notes: sql`coalesce(${orders.notes}, 'expired')`,
        expiresAt: null,
        updatedAt: new Date(),
      })
      .where(and(inArray(orders.id, ids), eq(orders.status, "pending")))
      .returning({ id: orders.id });

    // What the statement actually changed, not what was selected a moment
    // ago: an order the Stripe webhook paid in between is excluded by the
    // `pending` check above and must not be counted as released.
    return released.length;
  });
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export type OrderWithItems = typeof orders.$inferSelect & {
  items: (typeof orderItems.$inferSelect)[];
};

export async function getOrder(id: string, db?: Db): Promise<OrderWithItems | undefined> {
  const database = await resolveDb(db);
  return database.query.orders.findFirst({ where: eq(orders.id, id), with: { items: true } });
}

export async function getOrderBySessionId(
  sessionId: string,
  db?: Db,
): Promise<OrderWithItems | undefined> {
  const database = await resolveDb(db);
  return database.query.orders.findFirst({
    where: eq(orders.stripeCheckoutSessionId, sessionId),
    with: { items: true },
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
    with: { items: true },
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
// Fulfilment
// ---------------------------------------------------------------------------

export type OrderMutationResult = { ok: true } | { ok: false; error: string };

async function transitionOrder(
  database: Db,
  orderId: string,
  from: OrderStatus[],
  set: Partial<typeof orders.$inferInsert>,
): Promise<OrderMutationResult> {
  const order = await database.query.orders.findFirst({ where: eq(orders.id, orderId) });
  if (!order) return { ok: false, error: "Order not found." };
  if (!from.includes(order.status)) {
    return { ok: false, error: `Can't do this from status "${order.status}".` };
  }
  await database
    .update(orders)
    .set({ ...set, updatedAt: new Date() })
    .where(eq(orders.id, orderId));
  return { ok: true };
}

export async function setFulfilment(
  orderId: string,
  patch: { carrier: string; trackingNumber: string },
  db?: Db,
): Promise<OrderMutationResult> {
  const database = await resolveDb(db);
  return transitionOrder(database, orderId, ["paid"], {
    status: "fulfilled",
    fulfilledAt: new Date(),
    carrier: patch.carrier,
    trackingNumber: patch.trackingNumber,
  });
}

export async function markReadyForPickup(orderId: string, db?: Db): Promise<OrderMutationResult> {
  const database = await resolveDb(db);
  return transitionOrder(database, orderId, ["paid"], { status: "ready_for_pickup" });
}

export async function markPickedUp(orderId: string, db?: Db): Promise<OrderMutationResult> {
  const database = await resolveDb(db);
  return transitionOrder(database, orderId, ["ready_for_pickup", "paid"], { status: "picked_up" });
}

export type MarkRefundedResult =
  | { ok: true; releasedEditionNumbers: number[] }
  | { ok: false; error: string };

/**
 * Allowed from any post-payment status a full refund could reasonably
 * arrive during — `paid`/`fulfilled` (shipped orders) and
 * `ready_for_pickup`/`picked_up` (pickup orders; Stripe doesn't care which
 * side of the counter the item is on).
 *
 * `patch.release` decides what happens to this order's editions, and
 * defaults to `false` — a refunded order's editions stay `sold` unless the
 * caller explicitly asks otherwise. That default is deliberate, not an
 * oversight left over from v1: a refund often means the hat is coming back,
 * but not always (a partial refund as a goodwill gesture, a chargeback the
 * customer keeps the item through) and not always sellable even when it
 * does (worn, damaged, missing its box) — there is no way to infer any of
 * that from the refund alone, so the number only goes back into the run
 * when a human on the desk says so.
 *
 * When `release` is true, every edition still `sold` and pointing at this
 * order goes back to `available` (and `order_id` is cleared, unlike the
 * pending-hold release in `releaseOrder` — there's no later Stripe event
 * that could still land for a *refunded* order the way a late payment can
 * for a *cancelled* one, so nothing benefits from keeping the pointer, and
 * clearing it means "available" never points at a refunded order id) in the
 * same transaction as the status flip, so a refund and its release land
 * together or not at all — never a refund with the number quietly still
 * burned, and never a released number on an order that turns out not to be
 * refunded after all. The variant's `inventory_quantity` mirror (edition
 * products only ever use it as a read-side count, see
 * `syncVariantAvailableMirror`) is kept in sync the same way every other
 * edition-status change here keeps it in sync.
 *
 * Returns the numbers actually released (empty if `release` was false, or
 * true but this order had no `sold` editions to release — a plain-quantity
 * order, say) so callers can decide whether the refund email needs the
 * "number N has gone back into the run" line.
 */
export async function markRefunded(
  orderId: string,
  patch: { refundedAt?: Date; release?: boolean; note?: string },
  db?: Db,
): Promise<MarkRefundedResult> {
  const database = await resolveDb(db);

  return database.transaction(async (tx) => {
    const result = await transitionOrder(
      tx,
      orderId,
      ["paid", "fulfilled", "ready_for_pickup", "picked_up"],
      {
        status: "refunded",
        refundedAt: patch.refundedAt ?? new Date(),
      },
    );
    if (!result.ok) return result;

    // The desk's record of *why* the money went back, written in the same
    // transaction as the refund itself rather than after it. Refunding is
    // one-way — a second attempt is refused because the order is already
    // `refunded` — so a note written separately that failed could never be
    // retried, leaving a refund on the books with nothing saying why.
    if (patch.note) {
      const existing = await tx.query.orders.findFirst({ where: eq(orders.id, orderId) });
      await tx
        .update(orders)
        .set({
          notes: existing?.notes ? `${existing.notes}\n${patch.note}` : patch.note,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId));
    }

    if (!patch.release) return { ok: true, releasedEditionNumbers: [] };

    const sold = await tx
      .select({ id: editions.id, number: editions.number, variantId: editions.variantId })
      .from(editions)
      .where(and(eq(editions.orderId, orderId), eq(editions.status, "sold")))
      .orderBy(asc(editions.number));
    if (sold.length === 0) return { ok: true, releasedEditionNumbers: [] };

    await tx
      .update(editions)
      .set({ status: "available", reservedUntil: null, orderId: null })
      .where(and(eq(editions.orderId, orderId), eq(editions.status, "sold")));

    const touchedVariants = new Set(sold.map((e) => e.variantId));
    for (const variantId of touchedVariants) {
      await syncVariantAvailableMirror(tx, variantId);
    }

    return { ok: true, releasedEditionNumbers: sold.map((e) => e.number) };
  });
}

/** Appends a line to `orders.notes`, keeping whatever was already there —
 * used for events worth flagging on the order without changing its status,
 * like a partial Stripe refund (see the webhook's `charge.refunded`
 * handling: only a *full* refund calls `markRefunded`). */
export async function appendOrderNote(orderId: string, text: string, db?: Db): Promise<void> {
  const database = await resolveDb(db);
  const order = await database.query.orders.findFirst({ where: eq(orders.id, orderId) });
  if (!order) return;
  const notes = order.notes ? `${order.notes}\n${text}` : text;
  await database.update(orders).set({ notes, updatedAt: new Date() }).where(eq(orders.id, orderId));
}

// ---------------------------------------------------------------------------
// Stripe webhook idempotency
// ---------------------------------------------------------------------------

/** Records a Stripe event id; returns false if it was already seen (the
 * webhook should skip processing it again). */
export async function recordStripeEvent(id: string, type: string, db?: Db): Promise<boolean> {
  const database = await resolveDb(db);
  const [row] = await database
    .insert(stripeEvents)
    .values({ id, type })
    .onConflictDoNothing({ target: stripeEvents.id })
    .returning({ id: stripeEvents.id });
  return row !== undefined;
}

export async function markStripeEventProcessed(id: string, db?: Db): Promise<void> {
  const database = await resolveDb(db);
  await database
    .update(stripeEvents)
    .set({ processedAt: new Date() })
    .where(eq(stripeEvents.id, id));
}

/**
 * Undoes `recordStripeEvent` — called when the webhook's handler throws
 * after already claiming the idempotency slot, so Stripe's retry of the
 * same event id gets a fresh attempt instead of being silently skipped.
 */
export async function deleteStripeEvent(id: string, db?: Db): Promise<void> {
  const database = await resolveDb(db);
  await database.delete(stripeEvents).where(eq(stripeEvents.id, id));
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
    with: { items: true },
  });
}
