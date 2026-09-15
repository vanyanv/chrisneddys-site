import Link from "next/link";
import {
  getOrdersDashboardCounts,
  listOrdersForAdmin,
  type OrdersAdminFilter,
} from "@/lib/ordersAdmin";
import { OrdersTable, type OrdersTableRow } from "./OrdersTable";
import "@/styles/admin-orders.css";

export const dynamic = "force-dynamic";

const TABS: { key: OrdersAdminFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "paid", label: "Paid (to fulfil)" },
  { key: "ready_for_pickup", label: "Ready for pickup" },
  { key: "fulfilled", label: "Fulfilled" },
  { key: "refunded", label: "Refunded" },
  { key: "cancelled", label: "Cancelled" },
];

function tabHref(key: OrdersAdminFilter): string {
  return key === "all" ? "/admin/orders" : `/admin/orders?status=${key}`;
}

function olderHref(filter: OrdersAdminFilter, cursor: string): string {
  return filter === "all"
    ? `/admin/orders?cursor=${cursor}`
    : `/admin/orders?status=${filter}&cursor=${cursor}`;
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; cursor?: string }>;
}) {
  const { status: rawStatus, cursor } = await searchParams;
  const filter: OrdersAdminFilter = TABS.some((t) => t.key === rawStatus)
    ? (rawStatus as OrdersAdminFilter)
    : "all";

  const [{ rows, nextCursor }, counts] = await Promise.all([
    listOrdersForAdmin(filter, cursor),
    getOrdersDashboardCounts(),
  ]);

  const tableRows: OrdersTableRow[] = rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
  }));

  return (
    <>
      <div className="ord-head-row">
        <div>
          <h1 className="adm-h1">Orders</h1>
          <span className="adm-label ord-count" aria-live="polite">
            {rows.length} order{rows.length === 1 ? "" : "s"} &middot; {counts.toFulfil} to ship
            &middot; {counts.readyForPickup} ready for pickup
          </span>
        </div>
      </div>

      <nav className="ord-filter-row" aria-label="Filter by status">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={tabHref(tab.key)}
            className={`adm-filter-chip${filter === tab.key ? " is-on" : ""}`}
            aria-current={filter === tab.key ? "page" : undefined}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <p className="adm-empty">
          No orders yet. They land here the moment Stripe confirms a payment.
        </p>
      ) : (
        <OrdersTable rows={tableRows} />
      )}

      {nextCursor && (
        <div style={{ marginTop: 16 }}>
          <Link href={olderHref(filter, nextCursor)} className="adm-btn">
            Older →
          </Link>
        </div>
      )}
    </>
  );
}
