import "@/styles/admin-rack.css";
import "@/styles/admin-customers.css";
import "@/styles/admin-orders.css";

/**
 * `/admin/customers/[email]`'s loading skeleton — shown while `page.tsx`'s
 * `requireOwner()` and `getCustomerForAdmin`/`getStoreSettings` reads are in
 * flight. Mirrors that page's own header, stat row and orders card, same
 * as `admin/orders/[id]/loading.tsx` does for the order detail page.
 */
function skDelay(i: number): string {
  const step = i % 4;
  return step === 0 ? "rack-sk" : `rack-sk d${step}`;
}

export default function CustomerDetailLoading() {
  return (
    <div className="rack-root">
      <nav className="rack-topbar" aria-label="Admin sections">
        <span className="rack-sk" style={{ height: 22, width: 140, display: "block" }} />
        <div className="rack-tabs">
          <span className="rack-tab" aria-current="false">
            Overview
          </span>
          <span className="rack-tab" aria-current="false">
            Products
          </span>
          <span className="rack-tab" aria-current="false">
            Orders
          </span>
          <span className="rack-tab" aria-current="page">
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

      <div style={{ padding: "18px 22px 0" }}>
        <span className="rack-sk" style={{ height: 13, width: 150, display: "block" }} />
      </div>

      <div className="rack-page-header" style={{ paddingTop: 11 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
          <span className="rack-sk" style={{ width: 52, height: 52, borderRadius: 999 }} />
          <div>
            <span className="rack-sk" style={{ height: 26, width: 150, display: "block" }} />
            <span
              className="rack-sk d1"
              style={{ height: 12, width: 190, display: "block", marginTop: 8 }}
            />
          </div>
        </div>
        <div className="rack-page-header-right">
          <span className="rack-sk d2" style={{ height: 34, width: 110 }} />
        </div>
      </div>

      <div className="rack-stats">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rack-stat-card">
            <span className={skDelay(i)} style={{ height: 10, width: 60, display: "block" }} />
            <span
              className={skDelay(i + 1)}
              style={{ height: 28, width: 50, display: "block", marginTop: 8 }}
            />
          </div>
        ))}
      </div>

      <div style={{ padding: "0 22px 22px" }}>
        <section className="rack-order-card">
          <h3 className="rack-eyebrow rack-order-card-head">Orders</h3>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ display: "flex", gap: 13, padding: "12px 0" }}>
              <span className={skDelay(i)} style={{ height: 12, width: 60 }} />
              <span className={skDelay(i + 1)} style={{ height: 12, width: "40%" }} />
              <span className={skDelay(i + 2)} style={{ height: 12, width: 44 }} />
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
