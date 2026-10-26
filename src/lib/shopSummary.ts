import "server-only";

/**
 * The one-call picture of the shop for the restaurant dashboard: what is
 * waiting on the desk, the last N days of sales by Los Angeles calendar day,
 * what is nearly out of stock, and the settings an owner glances at. Reads
 * only; counts mirror the rules `ordersAdmin.ts` already uses for the
 * dashboard card.
 */
import { and, eq, gte, inArray, or } from "drizzle-orm";
import { getDb } from "@/db/client";
import { orders } from "@/db/schema";
import { listProductsForAdmin } from "@/lib/catalogAdmin";
import { getStoreSettings } from "@/lib/orders";

const DAY_MS = 24 * 60 * 60 * 1000;
const SHOP_TIME_ZONE = "America/Los_Angeles";
const LOW_STOCK_AT_OR_BELOW = 3;

const dayFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: SHOP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** `YYYY-MM-DD` of the Los Angeles calendar day `date` falls in. */
function laDay(date: Date): string {
  return dayFormat.format(date);
}

/** The `days` LA calendar days ending today, oldest first. Stepped as plain
 * calendar dates so a daylight-saving change can't skip or repeat a day. */
function lastLaDays(now: Date, days: number): string[] {
  const [y, m, d] = laDay(now).split("-").map(Number) as [number, number, number];
  const out: string[] = [];
  for (let back = days - 1; back >= 0; back--) {
    out.push(new Date(Date.UTC(y, m - 1, d - back)).toISOString().slice(0, 10));
  }
  return out;
}

export type ShopSummary = {
  ok: true;
  generatedAt: string;
  counts: {
    toShip: number;
    lateToShip: number;
    toBag: number;
    readyForPickup: number;
    shippedLast7: number;
    pickedUpLast7: number;
  };
  sales: {
    days: { date: string; paidCents: number; refundedCents: number; orders: number }[];
    paidCents: number;
    refundedCents: number;
    orders: number;
  };
  lowStock: {
    productId: string;
    name: string;
    slug: string;
    remaining: number;
    mode: "quantity" | "edition";
  }[];
  settings: {
    pickupEnabled: boolean;
    pickupAddress: string;
    shopPaused: boolean;
    pauseNote: string | null;
  };
};

export async function getShopSummary(
  options: { days?: number; now?: Date } = {},
): Promise<ShopSummary> {
  const now = options.now ?? new Date();
  const dayCount = options.days ?? 30;
  const db = await getDb();
  const dayAgo = new Date(now.getTime() - DAY_MS);
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
  // One extra day of slack so the oldest LA day is whole whatever the offset.
  const salesSince = new Date(now.getTime() - (dayCount + 1) * DAY_MS);

  const [open, saleRows, products, settings] = await Promise.all([
    db
      .select({
        status: orders.status,
        fulfilment: orders.fulfilment,
        paidAt: orders.paidAt,
      })
      .from(orders)
      .where(
        or(
          inArray(orders.status, ["paid", "ready_for_pickup"]),
          and(eq(orders.status, "fulfilled"), gte(orders.fulfilledAt, weekAgo)),
          and(eq(orders.status, "picked_up"), gte(orders.updatedAt, weekAgo)),
        ),
      ),
    db
      .select({
        status: orders.status,
        totalCents: orders.totalCents,
        paidAt: orders.paidAt,
        refundedAt: orders.refundedAt,
      })
      .from(orders)
      .where(or(gte(orders.paidAt, salesSince), gte(orders.refundedAt, salesSince))),
    listProductsForAdmin(),
    getStoreSettings(),
  ]);

  const counts = {
    toShip: 0,
    lateToShip: 0,
    toBag: 0,
    readyForPickup: 0,
    shippedLast7: 0,
    pickedUpLast7: 0,
  };
  for (const o of open) {
    if (o.status === "paid" && o.fulfilment === "ship") {
      counts.toShip += 1;
      if (o.paidAt && o.paidAt < dayAgo) counts.lateToShip += 1;
    } else if (o.status === "paid") {
      counts.toBag += 1;
    } else if (o.status === "ready_for_pickup") {
      counts.readyForPickup += 1;
    } else if (o.status === "fulfilled") {
      counts.shippedLast7 += 1;
    } else if (o.status === "picked_up") {
      counts.pickedUpLast7 += 1;
    }
  }

  const days = lastLaDays(now, dayCount).map((date) => ({
    date,
    paidCents: 0,
    refundedCents: 0,
    orders: 0,
  }));
  const byDate = new Map(days.map((d) => [d.date, d]));
  for (const row of saleRows) {
    if (row.paidAt && row.status !== "pending" && row.status !== "cancelled") {
      const bucket = byDate.get(laDay(row.paidAt));
      if (bucket) {
        bucket.paidCents += row.totalCents;
        bucket.orders += 1;
      }
    }
    if (row.refundedAt) {
      const bucket = byDate.get(laDay(row.refundedAt));
      if (bucket) bucket.refundedCents += row.totalCents;
    }
  }

  const lowStock: ShopSummary["lowStock"] = [];
  for (const p of products) {
    if (p.status !== "published") continue;
    const inv = p.inventory;
    const remaining =
      inv.mode === "quantity" ? inv.quantity : inv.mode === "edition" ? inv.available : null;
    if (remaining === null || inv.mode === "untracked" || remaining > LOW_STOCK_AT_OR_BELOW)
      continue;
    lowStock.push({
      productId: p.id,
      name: p.displayName1 || p.name,
      slug: p.slug,
      remaining,
      mode: inv.mode as "quantity" | "edition",
    });
  }
  lowStock.sort((a, b) => a.remaining - b.remaining || a.name.localeCompare(b.name));

  return {
    ok: true,
    generatedAt: now.toISOString(),
    counts,
    sales: {
      days,
      paidCents: days.reduce((s, d) => s + d.paidCents, 0),
      refundedCents: days.reduce((s, d) => s + d.refundedCents, 0),
      orders: days.reduce((s, d) => s + d.orders, 0),
    },
    lowStock,
    settings: {
      pickupEnabled: settings.pickupEnabled,
      pickupAddress: settings.pickupAddress,
      shopPaused: settings.shopPaused,
      pauseNote: settings.pauseNote,
    },
  };
}
