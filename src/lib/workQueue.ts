/**
 * Real data behind `/admin`'s "Today" screen (The Rack, phase 1 — see issue
 * #36's "1 — The shell and Today"). Every number here comes from Postgres
 * (or PGlite in tests and dev) through an existing lib function or a small
 * direct query on `orders` — nothing here is invented. Anything the design
 * (`Overview.dc.html`) shows that this file can't back with a real read is
 * deliberately left out of both the queue and the stats — see the PR
 * description for the specific list (an activity feed of hold/lapse events,
 * a sales-pace projection, and an "in the mail"/delivered distinction: none
 * of those are observable from data this system actually keeps).
 *
 * Both fulfilment methods reach the queue now (issue #49). A paid `ship`
 * order becomes a "to-pack" row and a paid `pickup` order becomes its own
 * "to-prepare-pickup" row — same shape, same real-data rule, counted and
 * ordered independently so a customer who chose pickup can never go
 * missing from "what needs doing right now" the way an earlier version of
 * this file deliberately left them out. The "To pack" KPI tile on Today
 * stays ship-only, matching what `Overview.dc.html`'s stat card actually
 * labels — pickup's own aggregate lives in the queue, not that tile.
 */
import { and, asc, desc, eq, gte, isNotNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { orders } from "@/db/schema";
import { getProductForAdmin, listProductsForAdmin, type AdminEdition } from "@/lib/catalogAdmin";
import { getSetupChecklist } from "@/lib/setupChecklist";

/** An unshipped order has to wait at least this long before it gets its own
 * highlighted queue row instead of just counting toward the aggregate "N
 * orders to pack" one. A judgment call, not a value from the design (which
 * only ever shows one illustrative example, "two days"). */
const STALE_HOURS = 24;

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function hoursSince(date: Date): number {
  return (Date.now() - date.getTime()) / 3_600_000;
}

function daysSince(date: Date): number {
  return Math.floor(hoursSince(date) / 24);
}

// ---------------------------------------------------------------------------
// Paid orders waiting on fulfilment — ship ("to-pack") and pickup
// ("to-prepare-pickup"), oldest first
// ---------------------------------------------------------------------------

export type ToPackOrder = {
  id: string;
  number: string;
  customerName: string | null;
  paidAt: Date;
  totalCents: number;
};

/** Paid orders for one fulfilment method that still need the owner to do
 * something — pack and ship it, or pull and prepare it for pickup — oldest
 * first, so index 0 is always the one that's been waiting longest. Shared
 * by both queue rows below; they differ only in which `fulfilment` they
 * filter to. */
async function getPaidOrdersAwaitingFulfilment(
  fulfilment: "ship" | "pickup",
): Promise<ToPackOrder[]> {
  const db = await getDb();
  const rows = await db
    .select({
      id: orders.id,
      number: orders.number,
      customerName: orders.name,
      paidAt: orders.paidAt,
      totalCents: orders.totalCents,
    })
    .from(orders)
    .where(and(eq(orders.status, "paid"), eq(orders.fulfilment, fulfilment)))
    .orderBy(asc(orders.paidAt));

  // `paidAt` is always stamped in the same transaction that sets
  // `status: "paid"` (see `markPaid` in src/lib/orders.ts), so it's never
  // null for a row this query can return.
  return rows.map((row) => ({ ...row, paidAt: row.paidAt as Date }));
}

async function getToPackOrders(): Promise<ToPackOrder[]> {
  return getPaidOrdersAwaitingFulfilment("ship");
}

/** The pickup counterpart of `getToPackOrders` — paid pickup orders that
 * haven't been marked ready yet. Once an order is `ready_for_pickup` it's
 * waiting on the customer, not the owner, so it deliberately drops out of
 * this list the same way a shipped order drops out of `getToPackOrders`. */
async function getToPreparePickupOrders(): Promise<ToPackOrder[]> {
  return getPaidOrdersAwaitingFulfilment("pickup");
}

// ---------------------------------------------------------------------------
// The run — edition inventory for whichever published product is numbered
// ---------------------------------------------------------------------------

export type RunOverview = {
  productName: string;
  editionSize: number;
  available: number;
  reserved: number;
  sold: number;
  editions: AdminEdition[];
};

/** The first published, edition-tracked product — in practice, the one
 * numbered run currently live. `listProductsForAdmin`/`getProductForAdmin`
 * are the same reads `/admin/products` uses, so this can never disagree
 * with what the Products sheet shows. */
export async function getRunOverview(): Promise<RunOverview | null> {
  const rows = await listProductsForAdmin();
  const row = rows.find((r) => r.status === "published" && r.inventory.mode === "edition");
  if (!row || row.inventory.mode !== "edition") return null;

  const detail = await getProductForAdmin(row.id);
  if (!detail) return null;

  return {
    productName: detail.name,
    editionSize: row.inventory.editionSize,
    available: row.inventory.available,
    reserved: row.inventory.reserved,
    sold: row.inventory.sold,
    editions: detail.editions,
  };
}

/** Total editions currently `reserved` (held by an open, unpaid checkout)
 * across every edition-tracked product — not just the featured run above,
 * in case a second one is ever live at once. */
async function getHeldEditionsCount(): Promise<number> {
  const rows = await listProductsForAdmin();
  return rows.reduce(
    (sum, row) => sum + (row.inventory.mode === "edition" ? row.inventory.reserved : 0),
    0,
  );
}

// ---------------------------------------------------------------------------
// Today's headline numbers
// ---------------------------------------------------------------------------

export type TodayStats = {
  moneyInTodayCents: number;
  ordersToday: number;
  toPackCount: number;
  toPackOldestDays: number | null;
  run: RunOverview | null;
};

export async function getTodayStats(): Promise<TodayStats> {
  const db = await getDb();

  const [paidToday, toPack, run] = await Promise.all([
    db
      .select({ totalCents: orders.totalCents })
      .from(orders)
      .where(and(isNotNull(orders.paidAt), gte(orders.paidAt, startOfToday()))),
    getToPackOrders(),
    getRunOverview(),
  ]);

  return {
    moneyInTodayCents: paidToday.reduce((sum, o) => sum + o.totalCents, 0),
    ordersToday: paidToday.length,
    toPackCount: toPack.length,
    toPackOldestDays: toPack[0] ? daysSince(toPack[0].paidAt) : null,
    run,
  };
}

// ---------------------------------------------------------------------------
// Just happened — recent paid orders (real events only)
// ---------------------------------------------------------------------------

export type RecentActivityEntry = {
  orderNumber: string;
  when: Date;
  totalCents: number;
};

/** The design's "Just happened" panel also narrates edition holds and
 * lapsed holds — this system has no event log for those, only the current
 * snapshot (`getRunOverview` above), so this feed sticks to the one event
 * that genuinely has a timestamp on file: an order being paid. */
export async function getRecentActivity(limit = 5): Promise<RecentActivityEntry[]> {
  const db = await getDb();
  const rows = await db
    .select({ number: orders.number, paidAt: orders.paidAt, totalCents: orders.totalCents })
    .from(orders)
    .where(isNotNull(orders.paidAt))
    .orderBy(desc(orders.paidAt))
    .limit(limit);

  return rows.map((row) => ({
    orderNumber: row.number,
    when: row.paidAt as Date,
    totalCents: row.totalCents,
  }));
}

// ---------------------------------------------------------------------------
// The queue itself
// ---------------------------------------------------------------------------

const SETUP_ITEM_COPY: Record<string, string> = {
  database: "Database isn't connected",
  payments: "Payments isn't fully set up",
  "photo-storage": "Photo storage isn't connected",
  email: "Email isn't connected",
};

export type WorkQueueItem =
  | {
      kind: "setup";
      key: string;
      title: string;
      detail: string;
      ctaLabel: string;
      ctaHref: string;
    }
  | {
      kind: "to-pack";
      count: number;
      totalCents: number;
      orderNumbers: string[];
      moreCount: number;
    }
  | {
      kind: "to-prepare-pickup";
      count: number;
      totalCents: number;
      orderNumbers: string[];
      moreCount: number;
    }
  | {
      kind: "stale-order";
      orderId: string;
      orderNumber: string;
      customerName: string | null;
      daysWaiting: number;
    }
  | {
      kind: "held-editions";
      count: number;
    };

/**
 * The work queue itself, in the order an owner would want to work through
 * it: a broken setup first (nothing downstream works right until it's
 * fixed), then the general backlog of ship orders to pack, then the single
 * oldest one if it's crossed `STALE_HOURS`, then the pickup counterpart of
 * that same backlog (issue #49 — pickup gets its own row rather than being
 * silently folded into or excluded from the ship count), then numbers
 * currently tied up in someone else's open checkout (informational — they
 * release on their own, see `releaseExpiredReservations`).
 *
 * Every item type is independently optional: an empty array means nothing
 * needs the owner's attention right now, which the caller renders as the
 * "Nothing else is waiting" line — see `getHealthyConnections` below for
 * the separate, always-on line about what's actually known to be fine.
 */
export async function getWorkQueue(): Promise<WorkQueueItem[]> {
  const items: WorkQueueItem[] = [];

  for (const check of getSetupChecklist()) {
    if (check.ok) continue;
    // `owner-sign-in` is deliberately skipped: reaching this queue at all
    // means the owner already signed in, so it can never be genuinely
    // broken here even if some other part of its config drifts.
    if (check.key === "owner-sign-in") continue;
    const title = SETUP_ITEM_COPY[check.key];
    if (!title) continue;
    items.push({
      kind: "setup",
      key: check.key,
      title,
      detail: check.detail,
      ctaLabel: "Set it up",
      ctaHref: "/admin/settings",
    });
  }

  const toPack = await getToPackOrders();
  const [oldest] = toPack;
  if (oldest) {
    items.push({
      kind: "to-pack",
      count: toPack.length,
      totalCents: toPack.reduce((sum, o) => sum + o.totalCents, 0),
      orderNumbers: toPack.slice(0, 3).map((o) => o.number),
      moreCount: Math.max(0, toPack.length - 3),
    });

    if (hoursSince(oldest.paidAt) >= STALE_HOURS) {
      items.push({
        kind: "stale-order",
        orderId: oldest.id,
        orderNumber: oldest.number,
        customerName: oldest.customerName,
        daysWaiting: Math.max(1, daysSince(oldest.paidAt)),
      });
    }
  }

  const toPreparePickup = await getToPreparePickupOrders();
  if (toPreparePickup.length > 0) {
    items.push({
      kind: "to-prepare-pickup",
      count: toPreparePickup.length,
      totalCents: toPreparePickup.reduce((sum, o) => sum + o.totalCents, 0),
      orderNumbers: toPreparePickup.slice(0, 3).map((o) => o.number),
      moreCount: Math.max(0, toPreparePickup.length - 3),
    });
  }

  const held = await getHeldEditionsCount();
  if (held > 0) {
    items.push({ kind: "held-editions", count: held });
  }

  return items;
}

// ---------------------------------------------------------------------------
// Today's always-on health line (issue #50)
// ---------------------------------------------------------------------------

/** Reading order + label for each checklist item that's fine to mention on
 * Today's health line — `owner-sign-in` is left out, same reasoning as
 * `getWorkQueue`'s skip above: it can never be genuinely broken here. */
const HEALTH_LABEL_ORDER: [key: string, label: string][] = [
  ["payments", "payments"],
  ["photo-storage", "photos"],
  ["email", "email"],
  ["database", "the database"],
];

/**
 * The systems genuinely known to be fine right now, in the order Today's
 * footer reads them out. Anything broken is left out here on purpose — it's
 * already sitting in `getWorkQueue`'s list as its own urgent "setup" row, so
 * this line never has to repeat it, and it never claims a system is fine
 * when the checklist above says otherwise. There is no fourth, unlisted
 * thing being silently vouched for: every entry here is one of the same
 * `process.env` reads `getSetupChecklist` already makes, nothing more.
 */
export function getHealthyConnections(): string[] {
  const checklist = getSetupChecklist();
  return HEALTH_LABEL_ORDER.filter(([key]) => checklist.find((c) => c.key === key)?.ok).map(
    ([, label]) => label,
  );
}
