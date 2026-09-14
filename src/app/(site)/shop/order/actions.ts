"use server";

import {
  getEditionSizes,
  getOrderByNumberAndEmail,
  type Fulfilment,
  type OrderStatus,
} from "@/lib/orders";

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

/**
 * Server action behind `/shop/order/`'s lookup form. Deliberately generic on
 * every kind of miss — unknown order number, wrong email for a real order,
 * or an order that hasn't paid yet — so the response can never be used to
 * test whether an email address placed an order here.
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

  const order = await getOrderByNumberAndEmail(number, email);
  if (!order || !VISIBLE_STATUSES.has(order.status)) {
    return { error: NOT_FOUND };
  }

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
