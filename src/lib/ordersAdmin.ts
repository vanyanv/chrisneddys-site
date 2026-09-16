import "server-only";

/**
 * The admin read/write layer behind `/admin/orders`. Every mutation here is
 * a thin wrapper around the matching `src/lib/orders.ts` transition — same
 * legal-transition rules, same rows written — plus `requireOwner()` and, for
 * the two transitions a customer would want to hear about, a best-effort
 * email. Reads (`listOrdersForAdmin`, `getOrderForAdmin`,
 * `getOrdersDashboardCounts`) are uncached, like `src/lib/catalogAdmin.ts`:
 * an owner looking at the desk has to see what's actually in the database.
 */
import { and, eq, gte, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { orderItems, orders, variants, type ShipTo } from "@/db/schema";
import { requireOwner } from "@/lib/auth";
import * as email from "@/lib/email";
import {
  appendOrderNote,
  getOrder,
  listOrders,
  markPickedUp as transitionPickedUp,
  markReadyForPickup as transitionReadyForPickup,
  markRefunded as transitionRefunded,
  setFulfilment as transitionShipped,
  type Fulfilment,
  type OrderStatus,
  type OrderWithItems,
} from "@/lib/orders";

export type OrderMutationResult = { ok: true } | { ok: false; error: string };

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

/**
 * The desk's filter tabs. "fulfilled" matches only `status === "fulfilled"`
 * (a shipped order) — a picked-up order's terminal status is `picked_up`,
 * which gets the same green status chip in the table but has no tab of its
 * own; it stays visible under "All".
 */
export type OrdersAdminFilter =
  | "all"
  | "paid"
  | "ready_for_pickup"
  | "fulfilled"
  | "refunded"
  | "cancelled";

const FILTER_STATUS: Record<OrdersAdminFilter, OrderStatus | undefined> = {
  all: undefined,
  paid: "paid",
  ready_for_pickup: "ready_for_pickup",
  fulfilled: "fulfilled",
  refunded: "refunded",
  cancelled: "cancelled",
};

export type AdminOrderListRow = {
  id: string;
  number: string;
  status: OrderStatus;
  fulfilment: Fulfilment;
  createdAt: Date;
  customerName: string | null;
  customerEmail: string | null;
  itemsSummary: string;
  totalCents: number;
};

export type ListOrdersForAdminResult = {
  rows: AdminOrderListRow[];
  nextCursor: string | null;
};

type ItemSummaryRow = { productName: string; quantity: number; editionNumber: number | null };
type ItemSummaryRowWithOrder = ItemSummaryRow & { orderId: string };

function summarizeItems(items: ItemSummaryRow[]): string {
  if (items.length === 0) return "—";
  return items
    .map((item) => {
      const edition = item.editionNumber !== null ? ` #${item.editionNumber}` : "";
      return `${item.productName}${edition} ×${item.quantity}`;
    })
    .join(", ");
}

/** Orders for the desk's table, newest first, one page (50) at a time —
 * `cursor` is the opaque id `listOrders` handed back as `nextCursor`. */
export async function listOrdersForAdmin(
  filter: OrdersAdminFilter,
  cursor?: string,
): Promise<ListOrdersForAdminResult> {
  const { orders: rows, nextCursor } = await listOrders({
    status: FILTER_STATUS[filter],
    cursor,
    limit: 50,
  });

  const db = await getDb();
  const orderIds = rows.map((r) => r.id);
  const items: ItemSummaryRowWithOrder[] =
    orderIds.length > 0
      ? await db
          .select({
            orderId: orderItems.orderId,
            productName: orderItems.productName,
            quantity: orderItems.quantity,
            editionNumber: orderItems.editionNumber,
          })
          .from(orderItems)
          .where(inArray(orderItems.orderId, orderIds))
      : [];

  const itemsByOrder = new Map<string, ItemSummaryRow[]>();
  for (const { orderId, ...item } of items) {
    itemsByOrder.set(orderId, [...(itemsByOrder.get(orderId) ?? []), item]);
  }

  return {
    rows: rows.map((order) => ({
      id: order.id,
      number: order.number,
      status: order.status,
      fulfilment: order.fulfilment,
      createdAt: order.createdAt,
      customerName: order.name,
      customerEmail: order.email,
      itemsSummary: summarizeItems(itemsByOrder.get(order.id) ?? []),
      totalCents: order.totalCents,
    })),
    nextCursor,
  };
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

export type AdminOrderItem = {
  id: string;
  productName: string;
  sku: string;
  unitPriceCents: number;
  quantity: number;
  editionNumber: number | null;
  /** The edition's run size, for a "Number 35 of 50" line — lives on the
   * variant, not the order item (see `getEditionSizes` in
   * `src/lib/orders.ts`), and projected on here the same way. `null` for a
   * plain quantity item, or if the variant itself has none. */
  editionSize: number | null;
  /** The purchased variant's own label (e.g. "One size", "Medium") — real,
   * customer-meaningful text for a packing slip, unlike the internal SKU. */
  variantLabel: string;
};

export type AdminOrderDetail = {
  id: string;
  number: string;
  status: OrderStatus;
  fulfilment: Fulfilment;
  email: string | null;
  name: string | null;
  phone: string | null;
  shipTo: ShipTo | null;
  items: AdminOrderItem[];
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  currency: string;
  carrier: string | null;
  trackingNumber: string | null;
  stripePaymentIntentId: string | null;
  notes: string | null;
  createdAt: Date;
  paidAt: Date | null;
  fulfilledAt: Date | null;
  refundedAt: Date | null;
  /** No dedicated column tracks when an order became `ready_for_pickup`,
   * `picked_up` or `cancelled` — only the current status does. The timeline
   * uses this as its best-effort timestamp for whichever of those is the
   * order's *current* status. */
  updatedAt: Date;
};

/** Variant facts order_items doesn't itself snapshot (edition size, the
 * variant's own label) — one query per order detail, keyed by variant id. */
async function variantFactsFor(
  order: OrderWithItems,
): Promise<Map<string, { editionSize: number | null; label: string }>> {
  const variantIds = [...new Set(order.items.map((item) => item.variantId))];
  if (variantIds.length === 0) return new Map();

  const db = await getDb();
  const rows = await db
    .select({ id: variants.id, editionSize: variants.editionSize, label: variants.label })
    .from(variants)
    .where(inArray(variants.id, variantIds));
  return new Map(rows.map((v) => [v.id, { editionSize: v.editionSize, label: v.label }]));
}

async function toAdminDetail(order: OrderWithItems): Promise<AdminOrderDetail> {
  const variantFacts = await variantFactsFor(order);
  return {
    id: order.id,
    number: order.number,
    status: order.status,
    fulfilment: order.fulfilment,
    email: order.email,
    name: order.name,
    phone: order.phone,
    shipTo: order.shipTo,
    items: order.items
      .slice()
      .sort((a, b) => (a.editionNumber ?? 0) - (b.editionNumber ?? 0))
      .map((item) => {
        const facts = variantFacts.get(item.variantId);
        return {
          id: item.id,
          productName: item.productName,
          sku: item.sku,
          unitPriceCents: item.unitPriceCents,
          quantity: item.quantity,
          editionNumber: item.editionNumber,
          editionSize: facts?.editionSize ?? null,
          variantLabel: facts?.label ?? item.productName,
        };
      }),
    subtotalCents: order.subtotalCents,
    shippingCents: order.shippingCents,
    taxCents: order.taxCents,
    totalCents: order.totalCents,
    currency: order.currency,
    carrier: order.carrier,
    trackingNumber: order.trackingNumber,
    stripePaymentIntentId: order.stripePaymentIntentId,
    notes: order.notes,
    createdAt: order.createdAt,
    paidAt: order.paidAt,
    fulfilledAt: order.fulfilledAt,
    refundedAt: order.refundedAt,
    updatedAt: order.updatedAt,
  };
}

/** Full detail for one order's admin page. Undefined if the id doesn't exist. */
export async function getOrderForAdmin(id: string): Promise<AdminOrderDetail | undefined> {
  const order = await getOrder(id);
  return order ? await toAdminDetail(order) : undefined;
}

// ---------------------------------------------------------------------------
// Dashboard counts
// ---------------------------------------------------------------------------

export type OrdersDashboardCounts = {
  toFulfil: number;
  readyForPickup: number;
  fulfilledThisWeek: number;
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Counts for the dashboard's Orders card: paid ship orders waiting to go
 * out, pickup orders waiting on the customer, and ship orders fulfilled in
 * the last 7 days. */
export async function getOrdersDashboardCounts(): Promise<OrdersDashboardCounts> {
  const db = await getDb();
  const weekAgo = new Date(Date.now() - WEEK_MS);

  const [toFulfilRows, readyRows, fulfilledRows] = await Promise.all([
    db
      .select({ id: orders.id })
      .from(orders)
      .where(and(eq(orders.status, "paid"), eq(orders.fulfilment, "ship"))),
    db.select({ id: orders.id }).from(orders).where(eq(orders.status, "ready_for_pickup")),
    db
      .select({ id: orders.id })
      .from(orders)
      .where(and(eq(orders.status, "fulfilled"), gte(orders.fulfilledAt, weekAgo))),
  ]);

  return {
    toFulfil: toFulfilRows.length,
    readyForPickup: readyRows.length,
    fulfilledThisWeek: fulfilledRows.length,
  };
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Best-effort shipping/pickup-ready/refund email. Any failure — a missing
 * Resend config, a thrown error mid-send — is swallowed here and never
 * blocks (or rolls back) the status change that already committed.
 *
 * `released` only matters for `kind === "refunded"` — it's whether
 * `markRefunded` actually put editions back in the pool, so the email can
 * say so (or, when it's false, stay silent rather than guess).
 */
async function notifyBestEffort(
  kind: "shipped" | "pickup_ready" | "refunded",
  orderId: string,
  released = false,
): Promise<void> {
  try {
    const order = await getOrder(orderId);
    if (!order) return;

    if (kind === "shipped") {
      await email.sendShippingNotice(order);
    } else if (kind === "pickup_ready") {
      await email.sendPickupReady(order);
    } else {
      await email.sendRefundConfirmation(order, { released });
    }
  } catch {
    // Best-effort only — see the doc comment above.
  }
}

export type MarkShippedPatch = { carrier: string; trackingNumber: string };

/** paid -> fulfilled, stamping carrier + tracking number. */
export async function markShipped(
  orderId: string,
  patch: MarkShippedPatch,
): Promise<OrderMutationResult> {
  await requireOwner();
  const carrier = patch.carrier.trim();
  const trackingNumber = patch.trackingNumber.trim();
  if (!carrier) return { ok: false, error: "Choose a carrier." };
  if (!trackingNumber) return { ok: false, error: "Enter a tracking number." };

  const result = await transitionShipped(orderId, { carrier, trackingNumber });
  if (!result.ok) return result;

  await notifyBestEffort("shipped", orderId);
  return { ok: true };
}

/** paid -> ready_for_pickup. */
export async function markReadyForPickup(orderId: string): Promise<OrderMutationResult> {
  await requireOwner();
  const result = await transitionReadyForPickup(orderId);
  if (!result.ok) return result;

  await notifyBestEffort("pickup_ready", orderId);
  return { ok: true };
}

/** ready_for_pickup | paid -> picked_up. No customer email — they're
 * standing at the counter. */
export async function markPickedUp(orderId: string): Promise<OrderMutationResult> {
  await requireOwner();
  return transitionPickedUp(orderId);
}

export type MarkRefundedInput = {
  /** Puts this order's editions back in the `available` pool as part of the
   * same transition — see `markRefunded` in `src/lib/orders.ts` for why this
   * defaults to `false` rather than following the refund automatically. */
  release?: boolean;
  /** Filed as an order note (`appendOrderNote`), never a new column and
   * never shown to the customer — the desk's own memory of why. */
  reason?: string;
};

/** paid | fulfilled -> refunded, for the case the Stripe webhook missed it.
 * The refund itself always happens in Stripe first — this only marks the
 * order so the desk matches reality. */
export async function markRefunded(
  orderId: string,
  input: MarkRefundedInput = {},
): Promise<OrderMutationResult> {
  await requireOwner();
  const result = await transitionRefunded(orderId, { release: input.release });
  if (!result.ok) return result;

  const reason = input.reason?.trim();
  if (reason) await appendOrderNote(orderId, `Refund reason: ${reason}`);

  await notifyBestEffort("refunded", orderId, result.releasedEditionNumbers.length > 0);
  return { ok: true };
}
