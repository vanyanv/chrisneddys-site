/** Small display helpers for `/admin/catering/**` — kept local to this
 * route, same reasoning as `../orders/format.ts`: nothing outside catering
 * needs them. */
import type { CateringOrder, CateringOrderStatus } from "@/lib/catering/orders";

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const dateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  weekday: "short",
  month: "short",
  day: "numeric",
});
const timeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  hour: "numeric",
  minute: "2-digit",
});

export function formatDateTime(date: Date): string {
  return dateTimeFormatter.format(date);
}
export function formatDate(date: Date): string {
  return dateFormatter.format(date);
}
export function formatTime(date: Date): string {
  return timeFormatter.format(date);
}

/** "3h", "21h", "2d" — the countdown chip on a needs-you row/card. Negative
 * (already overdue — the lazy-expiry check hasn't caught up with this read
 * yet) reads as "overdue" rather than a confusing negative number. */
export function formatCountdown(target: Date, now: Date = new Date()): string {
  const ms = target.getTime() - now.getTime();
  if (ms <= 0) return "overdue";
  const hours = Math.round(ms / (60 * 60 * 1000));
  if (hours < 1) return "<1h";
  if (hours < 48) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

const STORE_NAMES: Record<string, string> = { hollywood: "Hollywood", vannuys: "Van Nuys" };
export function storeName(id: string): string {
  return STORE_NAMES[id] ?? id;
}

export type CateringStatusPill = { label: string; pillClass: string };

/** Maps an order's status (+ whether it carries a pending change) to the
 * shared `.adm-pill` label/tone — same shape as `orderStatusPill` in
 * `../orders/format.ts`, catering's own status set. */
export function cateringStatusPill(
  status: CateringOrderStatus,
  hasPendingChange: boolean,
): CateringStatusPill {
  if (hasPendingChange && (status === "booked" || status === "requested")) {
    return { label: "CHANGE", pillClass: "is-attention" };
  }
  switch (status) {
    case "requested":
      return { label: "NEW", pillClass: "is-yellow" };
    case "booked":
      return { label: "BOOKED", pillClass: "is-live" };
    case "completed":
      return { label: "DONE", pillClass: "is-hidden" };
    case "declined":
      return { label: "DECLINED", pillClass: "is-hidden" };
    case "expired":
      return { label: "EXPIRED", pillClass: "is-hidden" };
    case "cancelled":
      return { label: "CANCELLED", pillClass: "is-hidden" };
    default:
      return { label: status.toUpperCase(), pillClass: "is-hidden" };
  }
}

export function statusLabel(status: CateringOrderStatus): string {
  switch (status) {
    case "requested":
      return "Requested";
    case "booked":
      return "Booked";
    case "completed":
      return "Completed";
    case "declined":
      return "Declined";
    case "expired":
      return "Expired";
    case "cancelled":
      return "Cancelled";
    case "draft":
      return "Draft";
    default:
      return status;
  }
}

export function fulfilmentLabel(fulfilment: string): string {
  return fulfilment === "delivery" ? "Delivery" : "Pickup";
}

/** A one-line "Northlight Pictures" / contact-name fallback for the list and
 * header — company first (the wireframes always lead with it when there is
 * one), the contact name otherwise. */
export function customerHeadline(order: Pick<CateringOrder, "company" | "contactName">): string {
  return order.company?.trim() || order.contactName;
}

export function stripePaymentUrl(paymentIntentId: string): string {
  return `https://dashboard.stripe.com/payments/${paymentIntentId}`;
}
