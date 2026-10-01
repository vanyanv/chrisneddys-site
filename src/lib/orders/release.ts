/**
 * Releasing a pending order's reservation: a cancelled checkout, an
 * expired session, or the sweep of expired holds.
 *
 * Part of `@/lib/orders` (see `src/lib/orders.ts`), which re-exports the
 * public names; import from there, not from here.
 */
import { and, eq, inArray, lt, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { editions, orders } from "@/db/schema";
import { resolveDb, syncVariantAvailableMirror } from "./shared";

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
