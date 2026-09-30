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
 *
 * The code lives in `src/lib/orders/`, one file per job: `settings`,
 * `checkout` (numbers, quotes, reservations), `payment`, `release`, `reads`,
 * `fulfilment`, `stripeEvents`, and `shared` for what they have in common.
 * This file is the one import path for all of it.
 */
import { revalidatePath, revalidateTag } from "next/cache";
import { isTestEnv } from "./orders/shared";

export { type Fulfilment, type OrderStatus } from "./orders/shared";
export {
  STORE_SETTINGS_TAG,
  type StoreSettings,
  type StoreSettingsPatch,
  type UpdateStoreSettingsResult,
  getPublicStoreSettings,
  getStoreSettings,
  reviveStoreSettings,
  updateStoreSettings,
} from "./orders/settings";
export {
  type CreatePendingOrderInput,
  type CreatePendingOrderResult,
  type Quote,
  type QuoteLine,
  type QuoteLineError,
  type Reservation,
  attachStripeSession,
  createPendingOrder,
  quoteCart,
  setOrderExpiry,
} from "./orders/checkout";
export {
  type MarkPaidInput,
  type MarkPaidResult,
  type MarkPaidResultItem,
  markPaid,
} from "./orders/payment";
export { type OrderIdentifier, releaseExpiredReservations, releaseOrder } from "./orders/release";
export {
  type ListOrdersInput,
  type ListOrdersResult,
  type OrderWithItems,
  getEditionSizes,
  getOrder,
  getOrderByNumberAndEmail,
  getOrderByPaymentIntentId,
  getOrderBySessionId,
  getProductLimits,
  listOrders,
} from "./orders/reads";
export {
  type MarkRefundedResult,
  type OrderMutationResult,
  appendOrderNote,
  markPickedUp,
  markReadyForPickup,
  markRefunded,
  setFulfilment,
} from "./orders/fulfilment";
export {
  deleteStripeEvent,
  markStripeEventProcessed,
  recordStripeEvent,
} from "./orders/stripeEvents";

/**
 * `revalidateTag("catalogue")` + `revalidatePath` for the storefront pages a
 * mutation could have changed — the same responsibility `catalogAdmin.ts`'s
 * callers carry today, packaged here so the checkout route and the Stripe
 * webhook don't have to import `next/cache` themselves. No-op under Vitest,
 * where there is no request/render context for `next/cache` to act on.
 */
export function catalogueChanged(slugs: string[] = []): void {
  if (isTestEnv()) return;
  revalidateTag("catalogue", { expire: 0 });
  revalidatePath("/shop/");
  for (const slug of slugs) revalidatePath(`/shop/${slug}/`);
}
