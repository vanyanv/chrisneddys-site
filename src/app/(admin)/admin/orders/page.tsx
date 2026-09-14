import Link from "next/link";
import { listOrdersForAdmin, type OrdersAdminFilter } from "@/lib/ordersAdmin";
import { formatCents, relativeTime, statusLabel } from "./format";

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

  const { rows, nextCursor } = await listOrdersForAdmin(filter, cursor);

  return (
    <>
      <h1 className="adm-h1">Orders</h1>

      <nav className="adm-tabs" aria-label="Filter by status">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={tabHref(tab.key)}
            className="adm-tab"
            aria-current={filter === tab.key ? "page" : undefined}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <div className="adm-table-wrap">
          <p className="adm-empty">
            No orders yet. They land here the moment Stripe confirms a payment.
          </p>
        </div>
      ) : (
        <>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Placed</th>
                  <th>Customer</th>
                  <th>Items</th>
                  <th>Fulfilment</th>
                  <th>Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link href={`/admin/orders/${row.id}`} className="adm-row-link">
                        <span className="adm-money">{row.number}</span>
                      </Link>
                    </td>
                    <td>{relativeTime(row.createdAt)}</td>
                    <td>
                      <Link href={`/admin/orders/${row.id}`} className="adm-row-link">
                        <span className="adm-product-name">{row.customerName ?? "—"}</span>
                        <span className="adm-product-slug">{row.customerEmail ?? "—"}</span>
                      </Link>
                    </td>
                    <td className="adm-items-cell">{row.itemsSummary}</td>
                    <td>
                      <span className="adm-chip" data-fulfilment={row.fulfilment}>
                        {row.fulfilment === "ship" ? "Ship" : "Pickup"}
                      </span>
                    </td>
                    <td className="adm-money">{formatCents(row.totalCents)}</td>
                    <td>
                      <span className="adm-chip" data-order-status={row.status}>
                        {statusLabel(row.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {nextCursor && (
            <div style={{ marginTop: 16 }}>
              <Link href={olderHref(filter, nextCursor)} className="adm-btn">
                Older →
              </Link>
            </div>
          )}
        </>
      )}
    </>
  );
}
