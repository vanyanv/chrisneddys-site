/**
 * The order emails' shared wording: subjects, headings, first name, the
 * edition numbers on an order, and the whole plain-text body. The HTML body
 * (`emailOrderHtml.ts`) is built from the same order data, and the senders
 * that put the two together are in `email.ts`.
 */
import { brand } from "@/data/brand";
import { absoluteUrl } from "@/lib/siteOrigin";
import type { OrderWithItems } from "@/lib/orders";

export type OrderItem = OrderWithItems["items"][number];
export type Settings = {
  pickupAddress: string;
  returnsPolicy: string | null;
  supportEmail: string;
};

export function centsToPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

// ---------------------------------------------------------------------------
// Shared order-shape helpers (used by both the text and HTML bodies)
// ---------------------------------------------------------------------------

/** The edition numbers on an order, ascending — empty for an order with no
 * numbered items. An edition product stores one order-item row per unit
 * (see `createPendingOrder` in `src/lib/orders.ts`), so this is also the
 * count of numbered units, not just distinct products. */
export function editionNumbersOf(order: OrderWithItems): number[] {
  return order.items
    .map((item) => item.editionNumber)
    .filter((n): n is number => n !== null)
    .sort((a, b) => a - b);
}

export function formatNumberList(numbers: number[]): string {
  if (numbers.length === 1) return `${numbers[0]}`;
  if (numbers.length === 2) return `${numbers[0]} and ${numbers[1]}`;
  return `${numbers.slice(0, -1).join(", ")} and ${numbers[numbers.length - 1]}`;
}

/** "Number 35 is yours." / "Numbers 35 and 36 are yours." / a generic
 * fallback for an order with no numbered items — the thing a buyer of a
 * numbered hat actually cares about, stated up front. */
export function receiptHeading(order: OrderWithItems): string {
  const numbers = editionNumbersOf(order);
  if (numbers.length === 1) return `Number ${numbers[0]} is yours.`;
  if (numbers.length > 1) return `Numbers ${formatNumberList(numbers)} are yours.`;
  return "Order confirmed.";
}

/** "Order CNE-1043 confirmed — number 35 of 50 is yours" for a single
 * numbered item (with the edition size only when it's actually known),
 * "... — numbers 35 and 36 are yours" for more than one, and the plain
 * generic subject for an order with no numbered items at all — a
 * quantity-only order has no number to print, so it falls back rather than
 * printing an empty value. */
export function receiptSubject(order: OrderWithItems, sizes: Map<string, number | null>): string {
  const generic = `Order ${order.number} confirmed — ${brand.name}`;
  const numbers = editionNumbersOf(order);
  if (numbers.length === 0) return generic;
  if (numbers.length > 1) {
    return `Order ${order.number} confirmed — numbers ${formatNumberList(numbers)} are yours`;
  }
  const item = order.items.find((i) => i.editionNumber === numbers[0]);
  const size = item ? sizes.get(item.variantId) : null;
  const of = size ? ` of ${size}` : "";
  return `Order ${order.number} confirmed — number ${numbers[0]}${of} is yours`;
}

/** "Order CNE-1043 shipped — USPS" once a carrier is on file, falling back
 * to the plain generic subject otherwise. No ETA is ever printed here — the
 * schema has no delivery-estimate column (`carrier`/`trackingNumber` only,
 * see `orders` in `src/db/schema.ts`), so there is nothing genuine to state
 * beyond the carrier. */
export function shippingSubject(order: OrderWithItems): string {
  if (!order.carrier) return `Order ${order.number} has shipped — ${brand.name}`;
  return `Order ${order.number} shipped — ${order.carrier}`;
}

export function firstName(order: OrderWithItems): string | null {
  const name = order.name?.trim();
  return name ? (name.split(/\s+/)[0] ?? null) : null;
}

// Resolved per send rather than at import, so an order email sent from a
// Vercel preview links back to that preview (see `src/lib/siteOrigin.ts`).
export const orderLookupUrl = () => absoluteUrl("/shop/order/");

function itemLine(item: OrderItem, sizes: Map<string, number | null>): string {
  if (item.editionNumber !== null) {
    const size = sizes.get(item.variantId);
    const of = size ? ` of ${size}` : "";
    return `  ${item.productName} — #${item.editionNumber}${of} — ${centsToPrice(item.unitPriceCents)}`;
  }
  return `  ${item.productName} × ${item.quantity} — ${centsToPrice(item.unitPriceCents * item.quantity)}`;
}

function totalsLines(order: OrderWithItems): string[] {
  const lines = [`Subtotal: ${centsToPrice(order.subtotalCents)}`];
  if (order.shippingCents > 0) lines.push(`Shipping: ${centsToPrice(order.shippingCents)}`);
  if (order.taxCents > 0) lines.push(`Tax: ${centsToPrice(order.taxCents)}`);
  lines.push(`Total: ${centsToPrice(order.totalCents)}`);
  return lines;
}

function fulfilmentLines(order: OrderWithItems, settings: Settings): string[] {
  if (order.fulfilment === "pickup") {
    return ["Pickup", `Pickup at ${settings.pickupAddress}. Bring this email.`];
  }
  const ship = order.shipTo;
  if (!ship) return ["Shipping"];
  const line2 = ship.line2 ? ` ${ship.line2}` : "";
  return [
    "Shipping to",
    `${ship.name}`,
    `${ship.line1}${line2}`,
    `${ship.city}, ${ship.state} ${ship.postalCode}`,
    ship.country,
  ];
}

export function textBody(
  heading: string,
  order: OrderWithItems,
  sizes: Map<string, number | null>,
  settings: Settings,
  extraLines: string[] = [],
): string {
  const lines = [
    heading,
    "",
    `Order ${order.number}`,
    "",
    ...order.items.map((item) => itemLine(item, sizes)),
    "",
    ...totalsLines(order),
    "",
    ...fulfilmentLines(order, settings),
    ...(extraLines.length > 0 ? ["", ...extraLines] : []),
  ];
  if (settings.returnsPolicy) lines.push("", settings.returnsPolicy);
  lines.push("", `Questions? ${settings.supportEmail}`);
  return lines.join("\n");
}
