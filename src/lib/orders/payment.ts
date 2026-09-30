/**
 * Marking an order paid once Stripe confirms it.
 *
 * Part of `@/lib/orders` (see `src/lib/orders.ts`), which re-exports the
 * public names; import from there, not from here.
 */
import { and, asc, eq, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { editions, orderItems, orders, variants, type ShipTo } from "@/db/schema";
import { resolveDb, syncVariantAvailableMirror } from "./shared";

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
