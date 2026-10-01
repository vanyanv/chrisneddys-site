/**
 * The Stripe webhook's idempotency log.
 *
 * Part of `@/lib/orders` (see `src/lib/orders.ts`), which re-exports the
 * public names; import from there, not from here.
 */
import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { stripeEvents } from "@/db/schema";
import { resolveDb } from "./shared";

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
