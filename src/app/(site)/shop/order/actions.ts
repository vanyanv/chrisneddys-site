"use server";

import { getDb } from "@/db/client";
import { resolveClientIp } from "@/lib/auth";
import {
  getEditionSizes,
  getOrderByNumberAndEmail,
  type Fulfilment,
  type OrderStatus,
} from "@/lib/orders";
import { checkIpThrottle, pruneSignInAttempts, recordSignInAttempt } from "@/lib/signInThrottle";

export type OrderLookupItem = {
  name: string;
  quantity: number;
  editionNumber: number | null;
  editionSize: number | null;
};

export type OrderLookupResult = {
  number: string;
  status: OrderStatus;
  fulfilment: Fulfilment;
  carrier: string | null;
  trackingNumber: string | null;
  items: OrderLookupItem[];
};

export type OrderLookupState = {
  error?: string;
  result?: OrderLookupResult;
};

/** Statuses this page will actually show a stranger with the right order
 * number and email — a `pending` (unpaid) or `cancelled` (released) order
 * gets the same "we couldn't find that order" as a typo, both because
 * neither is a purchase yet and to give a wrong email nothing to learn
 * from the response. */
const VISIBLE_STATUSES = new Set<OrderStatus>([
  "paid",
  "fulfilled",
  "ready_for_pickup",
  "picked_up",
  "refunded",
]);

const NOT_FOUND = "We couldn't find that order.";
const TOO_MANY_ATTEMPTS = "Too many attempts, try again in a few minutes.";

/** Separates this throttle from owner sign-in in the shared
 * `sign_in_attempts` table — see `src/lib/signInThrottle.ts`. */
const LOOKUP_KIND = "order_lookup";
/** A miss counts as a failure, a hit as success (see `lookupOrderAction`).
 * IP-only: unlike sign-in there is no separate "email" credential channel
 * worth locking independently, since the email is half of the guess. */
const MAX_LOOKUP_ATTEMPTS = 10;

/**
 * Server action behind `/shop/order/`'s lookup form. Deliberately generic on
 * every kind of miss — unknown order number, wrong email for a real order,
 * or an order that hasn't paid yet — so the response can never be used to
 * test whether an email address placed an order here. Throttled per IP
 * (10 failed lookups / 15 min, same window as owner sign-in) so it can't be
 * used as an oracle to brute-force (order number, email) pairs.
 */
export async function lookupOrderAction(
  _prev: OrderLookupState,
  formData: FormData,
): Promise<OrderLookupState> {
  const number = String(formData.get("number") ?? "")
    .trim()
    .toUpperCase();
  const email = String(formData.get("email") ?? "").trim();

  if (!number || !email) {
    return { error: "Enter your order number and the email you used at checkout." };
  }

  const db = await getDb();
  const ip = await resolveClientIp();
  const now = new Date();

  await pruneSignInAttempts(db, now);

  const throttle = await checkIpThrottle(db, ip, MAX_LOOKUP_ATTEMPTS, now, LOOKUP_KIND);
  if (throttle.locked) {
    await recordSignInAttempt(db, email, ip, false, now, LOOKUP_KIND);
    return { error: TOO_MANY_ATTEMPTS };
  }

  const order = await getOrderByNumberAndEmail(number, email);
  if (!order || !VISIBLE_STATUSES.has(order.status)) {
    await recordSignInAttempt(db, email, ip, false, now, LOOKUP_KIND);
    return { error: NOT_FOUND };
  }

  await recordSignInAttempt(db, email, ip, true, now, LOOKUP_KIND);

  const sizes = await getEditionSizes(order.items.map((i) => i.variantId));

  return {
    result: {
      number: order.number,
      status: order.status,
      fulfilment: order.fulfilment,
      carrier: order.carrier,
      trackingNumber: order.trackingNumber,
      items: order.items.map((item) => ({
        name: item.productName,
        quantity: item.quantity,
        editionNumber: item.editionNumber,
        editionSize: sizes.get(item.variantId) ?? null,
      })),
    },
  };
}
