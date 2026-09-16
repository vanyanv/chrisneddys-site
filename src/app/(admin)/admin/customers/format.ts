/** Small display helpers for `/admin/customers` and its detail page — kept
 * local to this route rather than in `src/lib`, the same reasoning
 * `admin/orders/format.ts` states for its own copy of the same idea:
 * nothing outside this route needs them. The status pill mapping is
 * duplicated from `admin/orders/format.ts` on purpose (rather than
 * imported across route folders) so a customer's order list reads with
 * the exact same badge an owner already knows from the orders desk. */

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function formatDateTime(date: Date): string {
  return dateTimeFormatter.format(date);
}

const monthYearFormatter = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" });

export function formatMonthYear(date: Date): string {
  return monthYearFormatter.format(date);
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  paid: "Paid",
  fulfilled: "Fulfilled",
  ready_for_pickup: "Ready for pickup",
  picked_up: "Picked up",
  refunded: "Refunded",
  cancelled: "Cancelled",
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

/** Same mapping as `admin/orders/format.ts`'s `orderStatusPill` — see that
 * file's doc comment for why "paid" reads differently for ship vs. pickup. */
export function orderStatusPill(
  status: string,
  fulfilment: string,
): { label: string; pillClass: string } {
  switch (status) {
    case "paid":
      return { label: fulfilment === "pickup" ? "TO PREPARE" : "TO SHIP", pillClass: "is-yellow" };
    case "ready_for_pickup":
      return { label: "READY", pillClass: "is-live" };
    case "fulfilled":
    case "picked_up":
      return { label: "DONE", pillClass: "is-live" };
    case "refunded":
      return { label: "REFUNDED", pillClass: "is-hidden" };
    case "cancelled":
      return { label: "CANCELLED", pillClass: "is-hidden" };
    default:
      return { label: statusLabel(status).toUpperCase(), pillClass: "is-hidden" };
  }
}
