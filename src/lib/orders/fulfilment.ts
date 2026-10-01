/**
 * Moving a paid order along: shipped, ready for pickup, picked up,
 * refunded, and notes on it.
 *
 * Part of `@/lib/orders` (see `src/lib/orders.ts`), which re-exports the
 * public names; import from there, not from here.
 */
import { and, asc, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { editions, orders } from "@/db/schema";
import { type OrderStatus, resolveDb, syncVariantAvailableMirror } from "./shared";

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
