/**
 * The read layer behind `/admin/customers` (issue #36 phase 7) — the one
 * phase of "The Rack" that needed a database migration.
 *
 * **A customer is a projection over `orders`, not a stored row.** There is
 * no `customers` table. `orders` already carries `name`/`email` per order
 * (`src/db/schema.ts`), and the same person can place several orders under
 * the same email — so "a customer" here is simply every order grouped by
 * the normalized (trimmed, lower-cased) email, computed live from `orders`
 * on every read, the same way `ordersAdmin.ts`'s reads are uncached: an
 * owner looking at a customer has to see what's actually in the database.
 *
 * Why a projection instead of a stored table: `email` is only ever set by
 * `markPaid` (`src/lib/orders.ts`) — `createPendingOrder` leaves it null
 * until then — so grouping live `orders` rows already excludes a guest
 * mid-checkout for free, with no risk of a separate table drifting out of
 * sync with the orders that are its only source of truth. Keeping a
 * synced `customers` table fresh would mean touching every order-status
 * transition in `src/lib/orders.ts` (`markPaid`, `markRefunded`,
 * `releaseOrder`, …) to upsert it — real surface area, on the one file this
 * phase was told not to destabilize, to maintain a cache of numbers this
 * store's order volume doesn't need cached. The one migration this phase
 * does ship (`drizzle/0008_complex_jamie_braddock.sql`) is a partial index
 * on `lower(trim(orders.email))` so that grouping stays cheap as orders
 * accumulate — additive, no backfill required, because there is no separate
 * table to backfill.
 *
 * **Identity caveat, stated plainly rather than solved:** email is the only
 * identity key available. Two emails for the same real person (a typo, a
 * work vs. personal address, gmail's dot-insensitivity) are, and remain,
 * two separate rows here — nothing in this file or its screens merges them.
 * `normalizeEmail` only folds case and surrounding whitespace, nothing more.
 */
import { desc, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { orderItems, orders } from "@/db/schema";
import { getRunForAdmin, type RunForAdmin } from "@/lib/runAdmin";

/** Trimmed, lower-cased — the one normalization this store applies to an
 * email before treating two orders as "the same customer". Exported so the
 * `/admin/customers/[email]` route can normalize its own path segment the
 * same way before looking anything up. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export type AdminCustomerListRow = {
  /** Normalized email — the identity key, and what the detail route is
   * keyed on. */
  key: string;
  /** The most recently used raw email, for display (preserves casing). */
  email: string;
  /** The name on the customer's most recent order; null is possible only if
   * every order of theirs somehow lacks one, which `markPaid` never leaves
   * true in practice. */
  name: string | null;
  orderCount: number;
  /** Sum of `total_cents` across every one of this email's orders,
   * including refunded ones — money that actually moved, not a
   * refund-adjusted "net" this schema has no column to compute exactly. */
  totalSpentCents: number;
  /** Earliest `paid_at` among their orders. Null only if every one of their
   * orders has a null `paid_at`, which shouldn't happen for a row that has
   * an email at all (see the module doc), but the type stays honest about
   * what the query can actually return. */
  firstOrderAt: Date | null;
  refundedCount: number;
  lastOrderAt: Date;
};

function toDateOrNull(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  return value instanceof Date ? value : new Date(value as string);
}

function toDate(value: unknown): Date {
  return value instanceof Date ? value : new Date(value as string);
}

/**
 * Every customer, newest-order-first. One row per distinct normalized
 * email among orders that have one at all — a guest whose checkout never
 * reached payment never appears, because their order never got one.
 */
export async function listCustomersForAdmin(): Promise<AdminCustomerListRow[]> {
  const db = await getDb();

  const rows = await db
    .select({
      key: sql<string>`lower(trim(${orders.email}))`,
      email: sql<string>`(array_agg(${orders.email} order by ${orders.createdAt} desc))[1]`,
      name: sql<string | null>`(array_agg(${orders.name} order by ${orders.createdAt} desc))[1]`,
      orderCount: sql<number>`count(*)::int`,
      totalSpentCents: sql<number>`coalesce(sum(${orders.totalCents}), 0)::int`,
      firstOrderAt: sql<string | null>`min(${orders.paidAt})`,
      lastOrderAt: sql<string>`max(${orders.createdAt})`,
      refundedCount: sql<number>`count(*) filter (where ${orders.status} = 'refunded')::int`,
    })
    .from(orders)
    .where(sql`${orders.email} is not null and trim(${orders.email}) <> ''`)
    .groupBy(sql`lower(trim(${orders.email}))`)
    .orderBy(desc(sql`max(${orders.createdAt})`));

  return rows.map((row) => ({
    key: row.key,
    email: row.email,
    name: row.name,
    orderCount: row.orderCount,
    totalSpentCents: row.totalSpentCents,
    firstOrderAt: toDateOrNull(row.firstOrderAt),
    refundedCount: row.refundedCount,
    lastOrderAt: toDate(row.lastOrderAt),
  }));
}

export type AdminCustomerOrderRow = {
  id: string;
  number: string;
  status: string;
  fulfilment: string;
  createdAt: Date;
  totalCents: number;
  itemsSummary: string;
};

export type AdminCustomerOwnedNumber = {
  productId: string;
  productName: string;
  number: number;
};

export type AdminCustomerDetail = {
  key: string;
  email: string;
  name: string | null;
  phone: string | null;
  orderCount: number;
  totalSpentCents: number;
  firstOrderAt: Date | null;
  refundedCount: number;
  orders: AdminCustomerOrderRow[];
  ownedNumbers: AdminCustomerOwnedNumber[];
  /** One run board per distinct product this customer holds a numbered
   * edition of — read-only reuse of the same `getRunForAdmin` "All fifty
   * numbers" query (`src/lib/runAdmin.ts`, issue #36 phase 3), so this page
   * never keeps its own second copy of what a run's board looks like. */
  runs: RunForAdmin[];
};

type ItemSummaryRow = { productName: string; quantity: number; editionNumber: number | null };

/** Same shape/format as `ordersAdmin.ts`'s `summarizeItems` — kept as its
 * own small copy here rather than exported from there, since nothing else
 * needs to import across that boundary for one string-join helper. */
function summarizeItems(items: ItemSummaryRow[]): string {
  if (items.length === 0) return "—";
  return items
    .map((item) => {
      const edition = item.editionNumber !== null ? ` #${item.editionNumber}` : "";
      return `${item.productName}${edition} ×${item.quantity}`;
    })
    .join(", ");
}

/**
 * Full detail for one customer, keyed on a normalized email. Undefined if
 * no order has ever carried that email — including a guest's still-pending
 * order, since `email` is null until `markPaid`.
 */
export async function getCustomerForAdmin(key: string): Promise<AdminCustomerDetail | undefined> {
  const db = await getDb();
  const normalized = normalizeEmail(key);
  if (!normalized) return undefined;

  const rows = await db
    .select()
    .from(orders)
    .where(sql`lower(trim(${orders.email})) = ${normalized}`)
    .orderBy(desc(orders.createdAt));

  if (rows.length === 0) return undefined;

  const latest = rows[0]!;
  const totalSpentCents = rows.reduce((sum, o) => sum + o.totalCents, 0);
  const refundedCount = rows.filter((o) => o.status === "refunded").length;
  const paidTimes = rows
    .map((o) => o.paidAt)
    .filter((d): d is Date => d !== null)
    .map((d) => d.getTime());
  const firstOrderAt = paidTimes.length > 0 ? new Date(Math.min(...paidTimes)) : null;
  const phone = rows.find((o) => o.phone)?.phone ?? null;

  const orderIds = rows.map((o) => o.id);
  const items =
    orderIds.length > 0
      ? await db
          .select({
            orderId: orderItems.orderId,
            productId: orderItems.productId,
            productName: orderItems.productName,
            quantity: orderItems.quantity,
            editionNumber: orderItems.editionNumber,
          })
          .from(orderItems)
          .where(inArray(orderItems.orderId, orderIds))
      : [];

  const itemsByOrder = new Map<string, ItemSummaryRow[]>();
  const ownedNumbers: AdminCustomerOwnedNumber[] = [];
  const productIdsWithRuns = new Set<string>();
  for (const item of items) {
    itemsByOrder.set(item.orderId, [
      ...(itemsByOrder.get(item.orderId) ?? []),
      { productName: item.productName, quantity: item.quantity, editionNumber: item.editionNumber },
    ]);
    if (item.editionNumber !== null) {
      ownedNumbers.push({
        productId: item.productId,
        productName: item.productName,
        number: item.editionNumber,
      });
      productIdsWithRuns.add(item.productId);
    }
  }
  ownedNumbers.sort((a, b) => a.productName.localeCompare(b.productName) || a.number - b.number);

  const runs = (
    await Promise.all([...productIdsWithRuns].map((productId) => getRunForAdmin(productId)))
  ).filter((run): run is RunForAdmin => run !== undefined);

  return {
    key: normalized,
    email: latest.email ?? normalized,
    name: latest.name,
    phone,
    orderCount: rows.length,
    totalSpentCents,
    firstOrderAt,
    refundedCount,
    orders: rows.map((order) => ({
      id: order.id,
      number: order.number,
      status: order.status,
      fulfilment: order.fulfilment,
      createdAt: order.createdAt,
      totalCents: order.totalCents,
      itemsSummary: summarizeItems(itemsByOrder.get(order.id) ?? []),
    })),
    ownedNumbers,
    runs,
  };
}
