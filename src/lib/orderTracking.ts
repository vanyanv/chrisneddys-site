/**
 * The order-tracking page's timeline — a pure function over the same fields
 * `/shop/order/`'s lookup action already returns, so the branching between a
 * shipped order, a picked-up order and a refunded one is unit-testable
 * without a DOM or a database.
 *
 * Deliberately narrow: the schema tracks `paidAt`, `fulfilledAt` and
 * `refundedAt` and nothing between them, so there is no "packed" step and no
 * delivery confirmation here — a step this can't back with a real timestamp
 * doesn't get drawn as done, and a step nothing in the schema will ever set
 * (delivery) doesn't get drawn as pending either. See DEPLOY.md's Payments
 * section and `src/db/schema.ts`'s `orders` table for what is and isn't
 * tracked.
 */

export type Fulfilment = "ship" | "pickup";
export type OrderStatus =
  | "pending"
  | "paid"
  | "fulfilled"
  | "ready_for_pickup"
  | "picked_up"
  | "refunded"
  | "cancelled";

export type TimelineInput = {
  status: OrderStatus;
  fulfilment: Fulfilment;
  paidAt: string | null;
  fulfilledAt: string | null;
  carrier: string | null;
  trackingNumber: string | null;
};

export type TimelineStep = {
  label: string;
  /** What's known about the step right now: a confirmation once it's real,
   * a plain status line while it's still ahead. */
  detail: string;
  done: boolean;
};

/** `null` for a refunded order — that isn't a step further along the same
 * line, it's a different line, and the page renders it on its own instead
 * of trying to fold it into "delivered". */
export function orderTimeline(input: TimelineInput): TimelineStep[] | null {
  if (input.status === "refunded") return null;

  const paid: TimelineStep = {
    label: "Payment taken",
    detail: input.paidAt ? "Confirmed" : "Waiting on payment",
    done: Boolean(input.paidAt),
  };

  if (input.fulfilment === "pickup") {
    const ready = input.status === "ready_for_pickup" || input.status === "picked_up";
    const pickedUp = input.status === "picked_up";
    return [
      paid,
      {
        label: "Ready for pickup",
        detail: ready ? "Ready at the counter" : "Not packed yet",
        done: ready,
      },
      {
        label: "Picked up",
        detail: pickedUp ? "Picked up" : "Waiting for you",
        done: pickedUp,
      },
    ];
  }

  const shipped = input.status === "fulfilled";
  const trackingLine =
    input.carrier && input.trackingNumber ? `${input.carrier} · ${input.trackingNumber}` : null;
  return [
    paid,
    {
      label: "On its way",
      detail: shipped ? (trackingLine ?? "Shipped") : "Not shipped yet",
      done: shipped,
    },
    {
      label: "Delivered",
      detail: trackingLine
        ? "Check the carrier's own tracking link above for delivery scans."
        : "Nothing to track until it ships.",
      done: false,
    },
  ];
}
