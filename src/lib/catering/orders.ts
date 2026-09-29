/**
 * The catering order data layer — `catering_orders`, `catering_order_items`
 * and `catering_events`. Mirrors the conventions of `src/lib/orders.ts`
 * (merch orders): every export takes an optional `db: Db` as its last
 * parameter (default `getDb()`) so tests can pass a PGlite instance, and a
 * write that touches more than one row goes through `db.transaction`.
 *
 * This module is deliberately just the data layer: pricing, quoting, slot
 * and lead-time math live in the pure domain library (`src/lib/catering/`,
 * built alongside this in phase 1/2) and are not re-derived here. Emails,
 * Stripe calls and the approve/decline/cancel/change *server actions* are
 * phase 3 — this module only records the resulting state changes.
 */
import { randomBytes } from "node:crypto";
import { and, asc, eq, ilike, lt, or, sql } from "drizzle-orm";
import { getDb, type Db } from "@/db/client";
import {
  cateringEvents,
  cateringOrderItems,
  cateringOrders,
  type CateringAddress,
  type CateringPendingChange,
} from "@/db/schema";

async function resolveDb(db: Db | undefined): Promise<Db> {
  return db ?? (await getDb());
}

export type CateringOrderStatus =
  | "draft"
  | "requested"
  | "booked"
  | "declined"
  | "expired"
  | "cancelled"
  | "completed";

export type CateringFulfilment = "pickup" | "delivery";

export type CateringOrder = typeof cateringOrders.$inferSelect;
export type CateringOrderItem = typeof cateringOrderItems.$inferSelect;
export type CateringEvent = typeof cateringEvents.$inferSelect;

export type CateringOrderWithItems = CateringOrder & { items: CateringOrderItem[] };

// ---------------------------------------------------------------------------
// Order numbers and tokens
// ---------------------------------------------------------------------------

/** `nextval('catering_order_number_seq')` formatted as `CAT-1001`. Safe
 * under concurrency, same as `nextOrderNumber` in `src/lib/orders.ts`. */
export async function nextCateringOrderNumber(db: Db): Promise<string> {
  const result = (await db.execute(
    sql`select nextval('catering_order_number_seq') as n`,
  )) as unknown as { rows: { n: string | number }[] };
  const row = result.rows[0];
  if (!row) throw new Error("nextval('catering_order_number_seq') returned no row");
  return `CAT-${Number(row.n)}`;
}

/** 24 random bytes as url-safe base64 (32 chars, no padding) — unguessable
 * enough to stand in for auth on the customer order link `/catering/o/
 * <token>/`, the same way a password-reset token would be. */
export function generateOrderToken(): string {
  return randomBytes(24).toString("base64url");
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export type CreateDraftOrderItemInput = {
  itemId: string;
  itemName: string;
  qty: number;
  wayId?: string | null;
  wayLabel?: string | null;
  toppings?: string[];
  toppingLabels?: string[];
  extras?: string[];
  extraLabels?: string[];
  unitCents: number;
  amountCents: number;
  forName?: string | null;
  note?: string | null;
};

export type CreateDraftOrderInput = {
  store: string;
  fulfilment: CateringFulfilment;
  eventAt: Date;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  company?: string | null;
  poNumber?: string | null;
  onsiteContactName?: string | null;
  onsiteContactPhone?: string | null;
  address?: CateringAddress | null;
  distanceMiles?: number | null;
  rangeUnknown?: boolean;
  plateSets?: number;
  items: CreateDraftOrderItemInput[];
  foodCents: number;
  deliveryCents?: number;
  taxCents: number;
  tipCents?: number;
  totalCents: number;
  customerNote?: string | null;
};

export type CreateDraftOrderResult = { orderId: string; number: string; token: string };

/**
 * Allocates an order number and an unguessable token, then inserts the
 * order (`status: "draft"`) and its line-item snapshots in one transaction.
 * Records nothing else — no `catering_events` row, no Stripe call: those
 * belong to the checkout route (phase 3) once it actually holds a card.
 */
export async function createDraftOrder(
  input: CreateDraftOrderInput,
  db?: Db,
): Promise<CreateDraftOrderResult> {
  const database = await resolveDb(db);

  return database.transaction(async (tx) => {
    const number = await nextCateringOrderNumber(tx);
    const token = generateOrderToken();

    const [order] = await tx
      .insert(cateringOrders)
      .values({
        number,
        token,
        status: "draft",
        store: input.store,
        fulfilment: input.fulfilment,
        eventAt: input.eventAt,
        contactName: input.contactName,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone,
        company: input.company ?? null,
        poNumber: input.poNumber ?? null,
        onsiteContactName: input.onsiteContactName ?? null,
        onsiteContactPhone: input.onsiteContactPhone ?? null,
        address: input.address ?? null,
        distanceMiles: input.distanceMiles != null ? String(input.distanceMiles) : null,
        rangeUnknown: input.rangeUnknown ?? false,
        plateSets: input.plateSets ?? 0,
        foodCents: input.foodCents,
        deliveryCents: input.deliveryCents ?? 0,
        taxCents: input.taxCents,
        tipCents: input.tipCents ?? 0,
        totalCents: input.totalCents,
        customerNote: input.customerNote ?? null,
      })
      .returning();
    if (!order) throw new Error("insert of the catering order returned nothing");

    await insertOrderItems(tx, order.id, input.items);

    return { orderId: order.id, number: order.number, token: order.token };
  });
}

async function insertOrderItems(
  tx: Db,
  orderId: string,
  items: CreateDraftOrderItemInput[],
): Promise<void> {
  for (const [position, item] of items.entries()) {
    await tx.insert(cateringOrderItems).values({
      orderId,
      position,
      itemId: item.itemId,
      itemName: item.itemName,
      qty: item.qty,
      wayId: item.wayId ?? null,
      wayLabel: item.wayLabel ?? null,
      toppings: item.toppings ?? [],
      toppingLabels: item.toppingLabels ?? [],
      extras: item.extras ?? [],
      extraLabels: item.extraLabels ?? [],
      unitCents: item.unitCents,
      amountCents: item.amountCents,
      forName: item.forName ?? null,
      note: item.note ?? null,
    });
  }
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

async function loadItems(db: Db, orderId: string): Promise<CateringOrderItem[]> {
  return db
    .select()
    .from(cateringOrderItems)
    .where(eq(cateringOrderItems.orderId, orderId))
    .orderBy(asc(cateringOrderItems.position));
}

export async function getOrderByToken(
  token: string,
  db?: Db,
): Promise<CateringOrderWithItems | undefined> {
  const database = await resolveDb(db);
  const order = await database.query.cateringOrders.findFirst({
    where: eq(cateringOrders.token, token),
  });
  if (!order) return undefined;
  return { ...order, items: await loadItems(database, order.id) };
}

export async function getOrderById(
  id: string,
  db?: Db,
): Promise<CateringOrderWithItems | undefined> {
  const database = await resolveDb(db);
  const order = await database.query.cateringOrders.findFirst({
    where: eq(cateringOrders.id, id),
  });
  if (!order) return undefined;
  return { ...order, items: await loadItems(database, order.id) };
}

export type CateringOrdersTab = "needs-you" | "upcoming" | "past";
export type ListOrdersInput = { tab: CateringOrdersTab; q?: string };

/**
 * The three admin list tabs:
 * - "needs-you": a `requested` order (awaiting approve/decline) or a
 *   `booked` order carrying a customer's pending change.
 * - "upcoming": `booked`, event still ahead, no pending change (that's
 *   "needs-you" instead).
 * - "past": anything settled (`completed`, `declined`, `expired`,
 *   `cancelled`) or a `booked` order whose event has already happened.
 *
 * `q`, when given, matches the order number, contact name or contact email
 * (case-insensitive, substring).
 */
export async function listOrders(input: ListOrdersInput, db?: Db): Promise<CateringOrder[]> {
  const database = await resolveDb(db);
  const now = new Date();

  const tabCondition =
    input.tab === "needs-you"
      ? or(
          eq(cateringOrders.status, "requested"),
          and(
            eq(cateringOrders.status, "booked"),
            sql`${cateringOrders.pendingChange} is not null`,
          ),
        )
      : input.tab === "upcoming"
        ? and(
            eq(cateringOrders.status, "booked"),
            sql`${cateringOrders.pendingChange} is null`,
            sql`${cateringOrders.eventAt} >= ${now}`,
          )
        : or(
            sql`${cateringOrders.status} in ('completed', 'declined', 'expired', 'cancelled')`,
            and(eq(cateringOrders.status, "booked"), lt(cateringOrders.eventAt, now)),
          );

  const qCondition = input.q?.trim()
    ? or(
        ilike(cateringOrders.number, `%${input.q.trim()}%`),
        ilike(cateringOrders.contactName, `%${input.q.trim()}%`),
        ilike(cateringOrders.contactEmail, `%${input.q.trim()}%`),
      )
    : undefined;

  return database
    .select()
    .from(cateringOrders)
    .where(qCondition ? and(tabCondition, qCondition) : tabCondition)
    .orderBy(asc(cateringOrders.eventAt));
}

/** Case-insensitive on email, newest event first — backs "Find my orders". */
export async function listOrdersByEmail(email: string, db?: Db): Promise<CateringOrder[]> {
  const database = await resolveDb(db);
  return database
    .select()
    .from(cateringOrders)
    .where(sql`lower(${cateringOrders.contactEmail}) = lower(${email})`)
    .orderBy(asc(cateringOrders.eventAt));
}

// ---------------------------------------------------------------------------
// Status transitions
// ---------------------------------------------------------------------------

export type OrderMutationResult = { ok: true } | { ok: false; error: string };

const ALLOWED_TRANSITIONS: Record<CateringOrderStatus, CateringOrderStatus[]> = {
  draft: ["requested", "cancelled"],
  requested: ["booked", "declined", "expired", "cancelled"],
  booked: ["cancelled", "completed"],
  declined: [],
  expired: [],
  cancelled: [],
  completed: [],
};

/**
 * Moves an order to `to`, refusing any transition not in
 * `ALLOWED_TRANSITIONS`. `patch` sets whatever extra columns that
 * transition implies (e.g. `approvedAt`, `declineReason`) — callers pass it
 * rather than this function guessing timestamps from the status alone, so a
 * caller with its own `now` (tests, the expiry cron) stays in control of it.
 */
export async function setStatus(
  orderId: string,
  to: CateringOrderStatus,
  patch: Partial<typeof cateringOrders.$inferInsert> = {},
  db?: Db,
): Promise<OrderMutationResult> {
  const database = await resolveDb(db);
  const order = await database.query.cateringOrders.findFirst({
    where: eq(cateringOrders.id, orderId),
  });
  if (!order) return { ok: false, error: "Order not found." };

  const allowed = ALLOWED_TRANSITIONS[order.status];
  if (!allowed.includes(to)) {
    return { ok: false, error: `Can't move a "${order.status}" order to "${to}".` };
  }

  await database
    .update(cateringOrders)
    .set({ ...patch, status: to, updatedAt: new Date() })
    .where(eq(cateringOrders.id, orderId));
  return { ok: true };
}

export type StripeIdsPatch = {
  checkoutSessionId?: string;
  paymentIntentId?: string;
  customerId?: string;
  paymentMethodId?: string;
};

/** Attaches whichever Stripe ids `patch` carries, leaving the rest as they
 * are — the checkout route and webhook each know a subset at a time. */
export async function attachStripeIds(
  orderId: string,
  patch: StripeIdsPatch,
  db?: Db,
): Promise<void> {
  const database = await resolveDb(db);
  const set: Partial<typeof cateringOrders.$inferInsert> = { updatedAt: new Date() };
  if (patch.checkoutSessionId !== undefined) set.stripeCheckoutSessionId = patch.checkoutSessionId;
  if (patch.paymentIntentId !== undefined) set.stripePaymentIntentId = patch.paymentIntentId;
  if (patch.customerId !== undefined) set.stripeCustomerId = patch.customerId;
  if (patch.paymentMethodId !== undefined) set.stripePaymentMethodId = patch.paymentMethodId;
  await database.update(cateringOrders).set(set).where(eq(cateringOrders.id, orderId));
}

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

export type CateringEventActor = "customer" | "owner" | "system";

/** Appends one row to `catering_events` — the order's timeline, shown on
 * `/admin/catering/[id]/`. Callers pass their own `at` only in tests; it
 * otherwise defaults to now. */
export async function recordEvent(
  orderId: string,
  kind: string,
  actor: CateringEventActor,
  detail?: Record<string, unknown>,
  db?: Db,
): Promise<CateringEvent> {
  const database = await resolveDb(db);
  const [row] = await database
    .insert(cateringEvents)
    .values({ orderId, kind, actor, detail: detail ?? null })
    .returning();
  if (!row) throw new Error("insert of the catering event returned nothing");
  return row;
}

// ---------------------------------------------------------------------------
// Pending change
// ---------------------------------------------------------------------------

/** Stashes a customer-submitted change for the owner to approve or
 * decline. Only meaningful on a `requested` or `booked` order — callers
 * (the change-request server action) check that before calling this. */
export async function setPendingChange(
  orderId: string,
  pendingChange: CateringPendingChange,
  db?: Db,
): Promise<void> {
  const database = await resolveDb(db);
  await database
    .update(cateringOrders)
    .set({ pendingChange, updatedAt: new Date() })
    .where(eq(cateringOrders.id, orderId));
}

/** Declines a pending change, leaving the order's own lines and totals
 * untouched. */
export async function clearPendingChange(orderId: string, db?: Db): Promise<void> {
  const database = await resolveDb(db);
  await database
    .update(cateringOrders)
    .set({ pendingChange: null, updatedAt: new Date() })
    .where(eq(cateringOrders.id, orderId));
}

/**
 * Approves an order's own pending change: replaces its line items with the
 * change's snapshot, overwrites the totals, and clears the pending change —
 * all in one transaction. Charging or refunding the difference (off-session,
 * or a re-authorization before capture) is the caller's job (phase 3); this
 * only moves the order's stored state to match what was approved.
 */
export async function applyPendingChange(orderId: string, db?: Db): Promise<OrderMutationResult> {
  const database = await resolveDb(db);

  return database.transaction(async (tx) => {
    const order = await tx.query.cateringOrders.findFirst({
      where: eq(cateringOrders.id, orderId),
    });
    if (!order) return { ok: false, error: "Order not found." };
    if (!order.pendingChange) return { ok: false, error: "No pending change on this order." };

    const change = order.pendingChange;

    await tx.delete(cateringOrderItems).where(eq(cateringOrderItems.orderId, orderId));
    await insertOrderItems(
      tx,
      orderId,
      change.lines.map((line) => ({
        itemId: line.itemId,
        itemName: line.itemName,
        qty: line.qty,
        wayId: line.wayId,
        wayLabel: line.wayLabel,
        toppings: line.toppings,
        toppingLabels: line.toppingLabels,
        extras: line.extras,
        extraLabels: line.extraLabels,
        unitCents: line.unitCents,
        amountCents: line.amountCents,
        forName: line.forName,
        note: line.note,
      })),
    );

    await tx
      .update(cateringOrders)
      .set({
        plateSets: change.plateSets,
        foodCents: change.foodCents,
        deliveryCents: change.deliveryCents,
        taxCents: change.taxCents,
        tipCents: change.tipCents,
        totalCents: change.totalCents,
        ...(change.eventAt !== undefined ? { eventAt: new Date(change.eventAt) } : {}),
        pendingChange: null,
        updatedAt: new Date(),
      })
      .where(eq(cateringOrders.id, orderId));

    return { ok: true };
  });
}

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

/** Appends a line to the owner's private note, keeping whatever was already
 * there — same shape as `appendOrderNote` in `src/lib/orders.ts`. */
export async function addOwnerNote(orderId: string, text: string, db?: Db): Promise<void> {
  const database = await resolveDb(db);
  const order = await database.query.cateringOrders.findFirst({
    where: eq(cateringOrders.id, orderId),
  });
  if (!order) return;
  const ownerNote = order.ownerNote ? `${order.ownerNote}\n${text}` : text;
  await database
    .update(cateringOrders)
    .set({ ownerNote, updatedAt: new Date() })
    .where(eq(cateringOrders.id, orderId));
}

// ---------------------------------------------------------------------------
// Expiry
// ---------------------------------------------------------------------------

/** Every `requested` order whose reply window has passed — what the expiry
 * cron (and a lazy check on read, phase 3) acts on. */
export async function findExpirable(now: Date = new Date(), db?: Db): Promise<CateringOrder[]> {
  const database = await resolveDb(db);
  return database
    .select()
    .from(cateringOrders)
    .where(and(eq(cateringOrders.status, "requested"), lt(cateringOrders.respondBy, now)));
}
