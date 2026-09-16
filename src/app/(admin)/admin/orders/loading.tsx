import "@/styles/admin-rack.css";
import "@/styles/admin-orders.css";

/**
 * `/admin/orders`'s loading skeleton (issue #36 phase 5, "Motion &
 * loading") — shown while `page.tsx`'s `requireOwner()` and its
 * `listOrdersForAdmin`/`getOrdersDashboardCounts`/`getStoreSettings` reads
 * are in flight. Same skeleton convention as `admin/products/loading.tsx`
 * and `admin/loading.tsx`: real data or a skeleton, never a guess. The row
 * skeleton reuses `OrdersTable`'s own `.ord-cols`/`.ord-row` grid so the
 * columns land in the same place the real list's do.
 */
function skDelay(i: number): string {
  const step = i % 4;
  return step === 0 ? "rack-sk" : `rack-sk d${step}`;
}

const TABS = ["All", "Paid (to fulfil)", "Ready for pickup", "Fulfilled", "Refunded", "Cancelled"];

export default function OrdersLoading() {
  return (
    <div className="rack-root">
      <nav className="rack-topbar" aria-label="Admin sections">
        <span className="rack-sk" style={{ height: 22, width: 140, display: "block" }} />
        <div className="rack-tabs">
          <span className="rack-tab" aria-current="false">
            Overview
          </span>
          <span className="rack-tab" aria-current="page">
            Orders
          </span>
          <span className="rack-tab" aria-current="false">
            Products
          </span>
          <span className="rack-tab" aria-current="false">
            Customers
          </span>
          <span className="rack-tab" aria-current="false">
            Settings
          </span>
        </div>
        <div className="rack-top-right">
          <span className="rack-sk" style={{ height: 22, width: 96 }} />
          <span className="rack-sk" style={{ width: 28, height: 28, borderRadius: 999 }} />
        </div>
      </nav>

      <div className="rack-page-header">
        <div>
          <h1 className="rack-page-title rack-bow">Orders</h1>
        </div>
        <div className="rack-page-header-right">
          <span className="rack-sk" style={{ height: 11, width: 220 }} />
        </div>
      </div>

      <div className="ord-filter-row" style={{ padding: "0 22px 15px" }}>
        <nav aria-label="Filter by status" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {TABS.map((label, i) => (
            <span key={label} className="adm-filter-chip" aria-hidden="true">
              <span className={skDelay(i)} style={{ height: 11, width: 40 + i * 6 }} />
            </span>
          ))}
        </nav>
      </div>

      <div style={{ padding: "0 22px 22px" }}>
        <div className="ord-sheet">
          <div className="ord-cols" role="presentation">
            <span>Order</span>
            <span>Placed</span>
            <span>Customer</span>
            <span>Items</span>
            <span>Method</span>
            <span>Total</span>
            <span>Status</span>
          </div>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="ord-row" style={{ cursor: "default" }}>
              <span className={skDelay(i)} style={{ height: 12, width: 48 }} />
              <span className={skDelay(i + 1)} style={{ height: 11, width: 40 }} />
              <span style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <span className={skDelay(i)} style={{ height: 11, width: "70%" }} />
                <span className={skDelay(i + 1)} style={{ height: 10, width: "85%" }} />
              </span>
              <span className={skDelay(i + 2)} style={{ height: 11, width: "60%" }} />
              <span className={skDelay(i)} style={{ height: 11, width: 40 }} />
              <span className={skDelay(i + 1)} style={{ height: 11, width: 50 }} />
              <span className={skDelay(i + 2)} style={{ height: 20, width: 70 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
