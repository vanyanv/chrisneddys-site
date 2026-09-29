/**
 * The server actions the customer order-link pages and the admin order page
 * call — everything that changes a catering order's state once it's past
 * checkout. Every mutating export records a `catering_events` row and sends
 * its email, and returns `{ok:true} | {ok:false, error}`, same shape as the
 * data layer's own `OrderMutationResult` (`orders.ts`).
 */
import "server-only";
import { itemById } from "@/data/menu";
import type { Db } from "@/db/client";
import type { CateringAddress, CateringPendingChangeLine } from "@/db/schema";
import { describeLine, quote, validateLine } from "./pricing";
import { refundForCancel } from "./cancellation";
import { dayStatus, earliestAllowed, slotToUtcMs } from "./schedule";
import { laDateString } from "./timezone";
import { isCateringStoreId } from "./stores";
import { getCateringSettings } from "./settings";
import { toScheduleDaysOff, toScheduleHours } from "./hours";
import {
  addOwnerNote,
  applyPendingChange,
  attachStripeIds,
  clearPendingChange,
  findExpirable,
  getOrderById,
  getOrderByToken,
  listOrdersByEmail,
  recordEvent,
  setPendingChange,
  setStatus,
  type CateringEvent,
  type CateringOrderWithItems,
} from "./orders";
import type { CartLine, CancellationQuote, Fulfilment, TipInput } from "./types";
import {
  cancelPaymentIntent,
  capturePaymentIntent,
  chargeOffSession,
  reauthorizeOffSession,
  refundPaymentIntent,
} from "./payments";
import {
  sendBookedEmail,
  sendCancelledEmail,
  sendChangeApprovedEmail,
  sendChangeDeclinedEmail,
  sendChangeReceivedEmail,
  sendDeclinedEmail,
  sendExpiredEmail,
  sendFindMyOrdersEmail,
} from "./emails";

export type ServiceResult = { ok: true } | { ok: false; error: string };

const CHANGE_LEAD_HOURS = 48;

function hoursUntil(eventMs: number, nowMs: number): number {
  return (eventMs - nowMs) / (60 * 60 * 1000);
}

// ---------------------------------------------------------------------------
// getOrderView
// ---------------------------------------------------------------------------

export type CateringOrderView = {
  ok: true;
  order: CateringOrderWithItems;
  events: CateringEvent[];
  cancellationQuote: CancellationQuote;
  canCancel: boolean;
  canChange: boolean;
};
export type GetOrderViewResult = CateringOrderView | { ok: false; error: string };

async function expireOneOrder(db: Db, order: CateringOrderWithItems): Promise<void> {
  await cancelPaymentIntent(order.stripePaymentIntentId ?? "");
  const moved = await setStatus(order.id, "expired", { expiresAt: new Date() }, db);
  if (!moved.ok) return;
  await recordEvent(order.id, "expired", "system", undefined, db);
  const reloaded = await getOrderById(order.id, db);
  if (reloaded) await sendExpiredEmail(reloaded);
}

/** The order, its timeline and its cancellation quote for `/catering/o/
 * <token>/`, lazily expiring it first if it's a `requested` order whose
 * reply window has already passed — a customer opening a stale link should
 * never see a request that's actually overdue as if it were still pending. */
export async function getOrderView(db: Db, token: string): Promise<GetOrderViewResult> {
  let order = await getOrderByToken(token, db);
  if (!order) return { ok: false, error: "Order not found." };

  if (order.status === "requested" && order.respondBy && order.respondBy.getTime() < Date.now()) {
    await expireOneOrder(db, order);
    order = await getOrderByToken(token, db);
    if (!order) return { ok: false, error: "Order not found." };
  }

  const eventsResult = await db.query.cateringEvents.findMany({
    where: (events, { eq }) => eq(events.orderId, order!.id),
    orderBy: (events, { asc }) => asc(events.at),
  });

  const cancellationQuote = refundForCancel(order.totalCents, order.eventAt.getTime(), Date.now());
  const canCancel = order.status === "requested" || order.status === "booked";
  const canChange =
    (order.status === "requested" || order.status === "booked") &&
    !order.pendingChange &&
    hoursUntil(order.eventAt.getTime(), Date.now()) >= CHANGE_LEAD_HOURS;

  return { ok: true, order, events: eventsResult, cancellationQuote, canCancel, canChange };
}

// ---------------------------------------------------------------------------
// cancelByCustomer
// ---------------------------------------------------------------------------

/**
 * Cancels a `requested` or `booked` order. Before capture this always
 * releases the whole hold — the card was never charged, so there's nothing
 * to apply a refund tier to. After capture, refunds the tier's share
 * (`refundForCancel`): free 48h+ out, half 24-48h, nothing inside 24h.
 */
export async function cancelByCustomer(db: Db, token: string): Promise<ServiceResult> {
  const order = await getOrderByToken(token, db);
  if (!order) return { ok: false, error: "Order not found." };
  if (order.status !== "requested" && order.status !== "booked") {
    return { ok: false, error: `Can't cancel a "${order.status}" order.` };
  }

  let refundCents = 0;
  if (order.status === "booked") {
    const tierQuote = refundForCancel(order.totalCents, order.eventAt.getTime(), Date.now());
    refundCents = tierQuote.refundCents;
    const refunded = await refundPaymentIntent(order.stripePaymentIntentId ?? "", refundCents);
    if (!refunded.ok) return { ok: false, error: refunded.error };
  } else {
    const cancelled = await cancelPaymentIntent(order.stripePaymentIntentId ?? "");
    if (!cancelled.ok) return { ok: false, error: cancelled.error };
  }

  const moved = await setStatus(
    order.id,
    "cancelled",
    { cancelledAt: new Date(), refundedCents: order.refundedCents + refundCents },
    db,
  );
  if (!moved.ok) return moved;

  await recordEvent(order.id, "cancelled", "customer", { refundCents }, db);
  const reloaded = await getOrderById(order.id, db);
  if (reloaded) await sendCancelledEmail(reloaded, refundCents);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// requestChange
// ---------------------------------------------------------------------------

export type RequestChangeInput = {
  lines: CartLine[];
  /** A new time of day on the *same* calendar date — the change flow never
   * offers a different date. */
  time?: string;
  tip?: TipInput;
};

function priceChangeLines(lines: CartLine[]): CateringPendingChangeLine[] {
  const priced = quote(lines, { fulfilment: "pickup" }).lines;
  return priced.map((line) => {
    const desc = describeLine(line);
    const item = itemById(line.itemId);
    return {
      itemId: line.itemId,
      itemName: item?.name ?? line.itemId,
      qty: line.qty,
      wayId: line.wayId,
      wayLabel: desc.wayLabel,
      toppings: line.toppings,
      toppingLabels: desc.toppingLabels,
      extras: line.extras,
      extraLabels: desc.extraLabels,
      unitCents: line.unitCents,
      amountCents: line.amountCents,
      forName: line.forName ?? null,
      note: line.note ?? null,
    };
  });
}

/**
 * Stashes a customer-submitted change for the owner's approve/decline.
 * Everything is re-validated and re-priced server-side, exactly like
 * checkout: client-sent prices are never trusted, and a line that fails
 * `validateLine` (or a new time that no longer clears lead time / an open
 * slot) is rejected outright rather than silently dropped.
 */
export async function requestChange(
  db: Db,
  token: string,
  input: RequestChangeInput,
): Promise<ServiceResult> {
  const order = await getOrderByToken(token, db);
  if (!order) return { ok: false, error: "Order not found." };
  if (order.status !== "requested" && order.status !== "booked") {
    return { ok: false, error: `Can't change a "${order.status}" order.` };
  }
  if (order.pendingChange) return { ok: false, error: "A change is already pending." };
  if (hoursUntil(order.eventAt.getTime(), Date.now()) < CHANGE_LEAD_HOURS) {
    return { ok: false, error: "Too close to the event to change this order." };
  }
  if (!isCateringStoreId(order.store)) return { ok: false, error: "Unknown store." };

  for (const line of input.lines) {
    const result = validateLine(line);
    if (!result.ok) return { ok: false, error: `Invalid line: ${result.errors.join(", ")}` };
  }

  const settings = await getCateringSettings(db);
  let eventAtMs = order.eventAt.getTime();
  if (input.time) {
    const dateStr = laDateString(eventAtMs);
    const hours = toScheduleHours(settings.hours);
    const daysOff = toScheduleDaysOff(settings.daysOff);
    const status = dayStatus(dateStr, order.store, hours, daysOff, Date.now(), settings.leadHours);
    if (status !== "open") return { ok: false, error: "That day is no longer available." };
    eventAtMs = slotToUtcMs(dateStr, input.time);
    if (eventAtMs < earliestAllowed(Date.now(), settings.leadHours)) {
      return { ok: false, error: "too-soon" };
    }
  }

  const fulfilment: Fulfilment = order.fulfilment;
  const priced = quote(input.lines, {
    fulfilment,
    deliveryFeeCents: settings.deliveryFeeCents,
    tip: input.tip,
  });

  await setPendingChange(
    order.id,
    {
      lines: priceChangeLines(input.lines),
      plateSets: order.plateSets,
      foodCents: priced.foodCents,
      deliveryCents: priced.deliveryCents,
      taxCents: priced.taxCents,
      tipCents: priced.tipCents,
      totalCents: priced.totalCents,
      requestedAt: new Date().toISOString(),
      ...(input.time ? { eventAt: new Date(eventAtMs).toISOString() } : {}),
    },
    db,
  );

  await recordEvent(
    order.id,
    "change_requested",
    "customer",
    { totalCents: priced.totalCents },
    db,
  );
  const reloaded = await getOrderById(order.id, db);
  if (reloaded) await sendChangeReceivedEmail(reloaded);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// findMyOrders
// ---------------------------------------------------------------------------

/** Always resolves `{ok: true}` — whether or not `email` matches any order
 * is never observable from the outside, so this can't be used to probe for
 * an address. */
export async function findMyOrders(db: Db, email: string): Promise<ServiceResult> {
  const orders = await listOrdersByEmail(email, db);
  await sendFindMyOrdersEmail(
    email,
    orders.map((o) => ({ number: o.number, token: o.token, eventAt: o.eventAt })),
  );
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Owner actions
// ---------------------------------------------------------------------------

export async function approveOrder(db: Db, id: string): Promise<ServiceResult> {
  const order = await getOrderById(id, db);
  if (!order) return { ok: false, error: "Order not found." };
  if (order.status !== "requested")
    return { ok: false, error: `Can't approve a "${order.status}" order.` };

  const captured = await capturePaymentIntent(order.stripePaymentIntentId ?? "");
  if (!captured.ok) return { ok: false, error: captured.error };

  const moved = await setStatus(id, "booked", { approvedAt: new Date() }, db);
  if (!moved.ok) return moved;

  await recordEvent(id, "approved", "owner", undefined, db);
  const reloaded = await getOrderById(id, db);
  if (reloaded) await sendBookedEmail(reloaded);
  return { ok: true };
}

export async function declineOrder(db: Db, id: string, reason: string): Promise<ServiceResult> {
  const order = await getOrderById(id, db);
  if (!order) return { ok: false, error: "Order not found." };
  if (order.status !== "requested")
    return { ok: false, error: `Can't decline a "${order.status}" order.` };

  const cancelled = await cancelPaymentIntent(order.stripePaymentIntentId ?? "");
  if (!cancelled.ok) return { ok: false, error: cancelled.error };

  const moved = await setStatus(
    id,
    "declined",
    { declinedAt: new Date(), declineReason: reason },
    db,
  );
  if (!moved.ok) return moved;

  await recordEvent(id, "declined", "owner", { reason }, db);
  const reloaded = await getOrderById(id, db);
  if (reloaded) await sendDeclinedEmail(reloaded, reason);
  return { ok: true };
}

/**
 * Approves a pending change: before capture, cancels the held payment
 * intent and holds a new manual-capture one off-session for the new total
 * (a full re-authorization); after capture, charges the saved card
 * off-session for the difference if the change costs more, or refunds the
 * difference if it costs less.
 */
export async function approveChange(db: Db, id: string): Promise<ServiceResult> {
  const order = await getOrderById(id, db);
  if (!order) return { ok: false, error: "Order not found." };
  const change = order.pendingChange;
  if (!change) return { ok: false, error: "No pending change on this order." };

  const description = `Catering order ${order.number} — approved change`;

  if (order.status === "requested") {
    const result = await reauthorizeOffSession(order.stripePaymentIntentId ?? "", {
      customerId: order.stripeCustomerId ?? "",
      paymentMethodId: order.stripePaymentMethodId ?? "",
      amountCents: change.totalCents,
      description,
    });
    if (!result.ok) return { ok: false, error: result.error };

    const applied = await applyPendingChange(id, db);
    if (!applied.ok) return applied;
    await attachStripeIds(id, { paymentIntentId: result.paymentIntentId }, db);
  } else if (order.status === "booked") {
    const diff = change.totalCents - order.totalCents;
    if (diff > 0) {
      const charged = await chargeOffSession({
        customerId: order.stripeCustomerId ?? "",
        paymentMethodId: order.stripePaymentMethodId ?? "",
        amountCents: diff,
        description,
      });
      if (!charged.ok) return { ok: false, error: charged.error };
    } else if (diff < 0) {
      const refunded = await refundPaymentIntent(order.stripePaymentIntentId ?? "", -diff);
      if (!refunded.ok) return { ok: false, error: refunded.error };
    }
    const applied = await applyPendingChange(id, db);
    if (!applied.ok) return applied;
  } else {
    return { ok: false, error: `Can't approve a change on a "${order.status}" order.` };
  }

  await recordEvent(id, "change_approved", "owner", { totalCents: change.totalCents }, db);
  const reloaded = await getOrderById(id, db);
  if (reloaded) await sendChangeApprovedEmail(reloaded);
  return { ok: true };
}

export async function declineChange(db: Db, id: string, reason?: string): Promise<ServiceResult> {
  const order = await getOrderById(id, db);
  if (!order) return { ok: false, error: "Order not found." };
  if (!order.pendingChange) return { ok: false, error: "No pending change on this order." };

  await clearPendingChange(id, db);
  await recordEvent(id, "change_declined", "owner", reason ? { reason } : undefined, db);
  const reloaded = await getOrderById(id, db);
  if (reloaded) await sendChangeDeclinedEmail(reloaded, reason);
  return { ok: true };
}

export async function markCompleted(db: Db, id: string): Promise<ServiceResult> {
  const moved = await setStatus(id, "completed", {}, db);
  if (!moved.ok) return moved;
  await recordEvent(id, "completed", "system", undefined, db);
  return { ok: true };
}

/** Every `requested` order whose reply window has passed — cancels the hold
 * and emails the customer for each. Best-effort across the batch: one
 * order's payment failure is recorded on that order only and never stops
 * the rest of the sweep (the cron route and `getOrderView`'s lazy check both
 * rely on that). */
export async function expireDue(
  db: Db,
  now: Date = new Date(),
): Promise<{ ok: true; count: number }> {
  const due = await findExpirable(now, db);
  for (const order of due) {
    const withItems = await getOrderById(order.id, db);
    if (withItems) await expireOneOrder(db, withItems);
  }
  return { ok: true, count: due.length };
}

export async function addNote(db: Db, id: string, text: string): Promise<ServiceResult> {
  await addOwnerNote(id, text, db);
  await recordEvent(id, "note", "owner", { text }, db);
  return { ok: true };
}

export type { CateringAddress };
