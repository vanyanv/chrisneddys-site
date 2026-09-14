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
