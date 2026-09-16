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
 * "Shipping only" per the design's admin annotation: every read here counts
 * `fulfilment: "ship"` orders only. Pickup orders still exist in the schema
 * and still show on the untouched `/admin/orders` sheet; they just aren't
 * part of Today's queue.
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
// To-pack orders (shipping only, oldest first)
// ---------------------------------------------------------------------------

export type ToPackOrder = {
  id: string;
  number: string;
  customerName: string | null;
  paidAt: Date;
  totalCents: number;
};

/** Paid, unshipped, ship-fulfilment orders — oldest first, so index 0 is
 * always the one that's been waiting longest. */
async function getToPackOrders(): Promise<ToPackOrder[]> {
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
    .where(and(eq(orders.status, "paid"), eq(orders.fulfilment, "ship")))
    .orderBy(asc(orders.paidAt));

  // `paidAt` is always stamped in the same transaction that sets
  // `status: "paid"` (see `markPaid` in src/lib/orders.ts), so it's never
  // null for a row this query can return.
  return rows.map((row) => ({ ...row, paidAt: row.paidAt as Date }));
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
 * fixed), then the general backlog of orders to pack, then the single
 * oldest one if it's crossed `STALE_HOURS`, then numbers currently tied up
 * in someone else's open checkout (informational — they release on their
 * own, see `releaseExpiredReservations`).
 *
 * Every item type is independently optional: an empty array means nothing
 * needs the owner's attention right now, which the caller renders as the
 * "Nothing else is waiting" line.
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

  const held = await getHeldEditionsCount();
  if (held > 0) {
    items.push({ kind: "held-editions", count: held });
  }

  return items;
}
