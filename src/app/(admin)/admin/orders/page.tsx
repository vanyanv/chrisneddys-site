import Image from "next/image";
import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { signOutAction } from "@/app/(admin)/admin/actions";
import { ownerInitials } from "@/app/(admin)/admin/ownerDisplay";
import {
  getOrdersDashboardCounts,
  listOrdersForAdmin,
  type OrdersAdminFilter,
} from "@/lib/ordersAdmin";
import { getStoreSettings } from "@/lib/orders";
import { isShopOpenFor } from "@/lib/shopStatus";
import { OrdersTable, type OrdersTableRow } from "./OrdersTable";
import "@/styles/admin-rack.css";
import "@/styles/admin-orders.css";

export const dynamic = "force-dynamic";

/** `/admin/orders` — The Rack's order desk (issue #36 phase 4). Owns its own
 * shell exactly like Today (`src/app/(admin)/admin/page.tsx`) and the
 * catalogue (`src/app/(admin)/admin/products/page.tsx`) do, rather than the
 * Sheet chrome `admin/layout.tsx` used to give it. The list itself
 * (`OrdersTable`, the filter chips, search, pagination) is untouched from
 * before this phase — `Orders.dc.html` draws the same shape (a sheet of
 * rows behind a status-chip row and a search box) this already had, so the
 * change here is the chrome around it, not the list. `Orders.dc.html`'s
 * checkbox column and bulk "Print N slips"/"Mark shipped"/"Refund" bar have
 * no bulk actions behind them anywhere in this codebase — `markShipped`,
 * `markRefunded` and the packing slip all take one order at a time — so
 * they're left out rather than built as UI with nothing real underneath;
 * see this phase's report for the full note. */
const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/settings", label: "Settings" },
];

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
  const session = await requireOwner();
  const { status: rawStatus, cursor } = await searchParams;
  const filter: OrdersAdminFilter = TABS.some((t) => t.key === rawStatus)
    ? (rawStatus as OrdersAdminFilter)
    : "all";

  const [{ rows, nextCursor }, counts, settings] = await Promise.all([
    listOrdersForAdmin(filter, cursor),
    getOrdersDashboardCounts(),
    getStoreSettings(),
  ]);

  const tableRows: OrdersTableRow[] = rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
  }));

  const shopOpen = isShopOpenFor(settings);
  const initials = ownerInitials(session);

  return (
    <div className="rack-root">
      <nav className="rack-topbar" aria-label="Admin sections">
        <Link href="/admin" className="rack-brand">
          <Image
            src="/cne-logo-2x.webp"
            alt="Chris N Eddy's"
            width={309}
            height={87}
            className="rack-logo"
            priority
          />
          <span className="rack-wordmark-tag rack-mono">STORE</span>
        </Link>
        <div className="rack-tabs">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rack-tab"
              aria-current={item.href === "/admin/orders" ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </div>
        <div className="rack-top-right">
          <span className={`rack-store-pill rack-mono ${shopOpen ? "" : "is-closed"}`}>
            <i></i>Store: {shopOpen ? "Open" : "Closed"}
          </span>
          <details className="rack-avatar-menu">
            <summary className="rack-avatar">{initials}</summary>
            <div className="rack-menu">
              <p className="rack-menu-email">{session.email}</p>
              <form action={signOutAction}>
                <button type="submit" className="rack-menu-signout">
                  Sign out
                </button>
              </form>
            </div>
          </details>
        </div>
      </nav>

      <div className="rack-page-header">
        <div>
          <h1 className="rack-page-title rack-bow">Orders</h1>
        </div>
        <div className="rack-page-header-right">
          <span className="rack-page-count rack-mono">
            {rows.length} order{rows.length === 1 ? "" : "s"} &middot; {counts.toFulfil} to ship
            &middot; {counts.readyForPickup} ready for pickup
          </span>
        </div>
      </div>

      <div className="ord-filter-row" style={{ padding: "0 22px 15px" }}>
        <nav aria-label="Filter by status" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
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
      </div>

      <div style={{ padding: "0 22px 22px" }}>
        {rows.length === 0 ? (
          <p className="adm-empty">
            No orders yet. They land here the moment Stripe confirms a payment.
          </p>
        ) : (
          <OrdersTable rows={tableRows} />
        )}

        {nextCursor && (
          <div style={{ marginTop: 16 }}>
            <Link href={olderHref(filter, nextCursor)} className="rack-btn">
              Older →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
