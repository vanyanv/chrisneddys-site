/**
 * Pure time-window helper for `src/app/(site)/shop/thanks/page.tsx`: a
 * `?session_id=` alone is enough to load an order, so full order details
 * (items, edition number, totals) are only rendered within a couple of
 * hours of payment — after that, a page carrying just the URL only gets the
 * order number and a pointer to `/shop/order/` (which requires the order's
 * email too).
 *
 * No Next/DB imports here so it stays trivially unit-testable, same
 * reasoning as `src/lib/ownerAllowlist.ts`.
 */

export type OrderStatusForVisibility =
  | "pending"
  | "paid"
  | "fulfilled"
  | "ready_for_pickup"
  | "picked_up"
  | "refunded"
  | "cancelled";

/** How long after `paid_at` the thanks page still shows full order details. */
export const FULL_DETAIL_WINDOW_MS = 2 * 60 * 60 * 1000;

/**
 * Whether the thanks page should render full order details for `order`
 * right now. A `pending`/still-confirming order isn't covered by this check
 * at all — `ThanksPage` handles that status before it ever gets here — so
 * this only needs to gate the "payment went through" statuses on how long
 * ago `paidAt` was.
 */
export function canShowFullOrderDetails(
  order: { status: OrderStatusForVisibility; paidAt: Date | null },
  now: Date = new Date(),
): boolean {
  if (order.status === "pending") return true;
  if (!order.paidAt) return false;
  return now.getTime() - order.paidAt.getTime() <= FULL_DETAIL_WINDOW_MS;
}
