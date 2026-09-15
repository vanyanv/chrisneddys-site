/** Small display helpers shared by the orders list, detail, and packing-slip
 * pages — kept local to this route rather than in `src/lib` since nothing
 * outside `/admin/orders` needs them. */

export const CARRIERS = ["USPS", "UPS", "FedEx", "Other"] as const;
export type Carrier = (typeof CARRIERS)[number];

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function formatDateTime(date: Date): string {
  return dateTimeFormatter.format(date);
}

/** "2h ago" / "3d ago" / "just now" — the same coarse glance format the
 * products list uses. */
export function relativeTime(date: Date): string {
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 45) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
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

/** Maps a status (+ fulfilment, since "paid" reads differently for a ship
 * vs. a pickup order) to the Sheet's `.adm-pill` label and tone class. The
 * raw status word stays available separately via `statusLabel` for a
 * `title`/`aria-label` on the pill, since the label here is deliberately
 * shorter than the underlying status. */
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

/** `listOrdersForAdmin`'s row only carries the already-joined
 * `"Name #3 ×2, Other ×1"` summary string, not the raw item list — this
 * just re-splits it for the list row's "first item + N more" display
 * without adding a new query. Safe as long as a product name never itself
 * contains ", ", true of the seed catalogue and any name seen so far. */
export function itemsShortSummary(itemsSummary: string): { first: string; moreCount: number } {
  if (itemsSummary === "—") return { first: "—", moreCount: 0 };
  const parts = itemsSummary.split(", ");
  return { first: parts[0] ?? "—", moreCount: parts.length - 1 };
}

/** USPS/UPS/FedEx tracking URL patterns. Null for "Other" or an unrecognised
 * carrier — the tracking number still shows, just without a link. */
export function trackingUrl(carrier: string, trackingNumber: string): string | null {
  const encoded = encodeURIComponent(trackingNumber);
  switch (carrier) {
    case "USPS":
      return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encoded}`;
    case "UPS":
      return `https://www.ups.com/track?loc=en_US&tracknum=${encoded}`;
    case "FedEx":
      return `https://www.fedex.com/fedextrack/?trknbr=${encoded}`;
    default:
      return null;
  }
}

export function stripePaymentUrl(paymentIntentId: string): string {
  return `https://dashboard.stripe.com/payments/${paymentIntentId}`;
}
