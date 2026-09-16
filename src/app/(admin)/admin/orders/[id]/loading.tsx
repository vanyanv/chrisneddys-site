import "@/styles/admin-rack.css";
import "@/styles/admin-orders.css";

/**
 * `/admin/orders/[id]`'s loading skeleton (issue #36 phase 5, "Motion &
 * loading") — shown while `page.tsx`'s `requireOwner()` and its
 * `getOrderForAdmin`/`getStoreSettings` reads are in flight. Mirrors that
 * page's own three-card main column and three-card side column rather than
 * a generic skeleton, same as the rest of The Rack's loading states.
 */
function skDelay(i: number): string {
  const step = i % 4;
  return step === 0 ? "rack-sk" : `rack-sk d${step}`;
}

export default function OrderDetailLoading() {
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
          <span className="rack-tab" aria-current="page">
            Orders
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
        <span className="rack-sk" style={{ height: 13, width: 90, display: "block" }} />
      </div>

      <div className="rack-page-header" style={{ paddingTop: 11 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 13, flexWrap: "wrap" }}>
          <span className="rack-sk" style={{ height: 34, width: 130 }} />
          <span className="rack-sk d1" style={{ height: 20, width: 90 }} />
        </div>
        <div className="rack-page-header-right">
          <span className="rack-sk d2" style={{ height: 34, width: 110 }} />
          <span className="rack-sk d3" style={{ height: 34, width: 90 }} />
        </div>
      </div>

      <div className="rack-order-grid">
        <div className="rack-order-main">
          <section className="rack-order-card">
            <h3 className="rack-eyebrow rack-order-card-head">Items</h3>
            {[0, 1].map((i) => (
              <div
                key={i}
                className="ord-item-row"
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0" }}
              >
                <span className={skDelay(i)} style={{ width: 36, height: 36, flex: "none" }} />
                <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                  <span className={skDelay(i)} style={{ height: 12, width: "60%" }} />
                  <span className={skDelay(i + 1)} style={{ height: 10, width: "35%" }} />
                </span>
                <span className={skDelay(i + 2)} style={{ height: 12, width: 44 }} />
              </div>
            ))}
          </section>
          <section className="rack-order-card">
            <h3 className="rack-eyebrow rack-order-card-head">Timeline</h3>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ display: "flex", gap: 10, padding: "8px 0" }}>
                <span className={skDelay(i)} style={{ width: 8, height: 8, borderRadius: 999 }} />
                <span className={skDelay(i)} style={{ height: 11, width: "30%" }} />
                <span className={skDelay(i + 1)} style={{ height: 11, width: "25%" }} />
              </div>
            ))}
          </section>
        </div>

        <div className="rack-order-side">
          <div className="rack-panel rack-order-next">
            <h3 className="rack-eyebrow rack-order-card-head">Next</h3>
            <span className="rack-sk" style={{ height: 34, width: "100%", display: "block" }} />
          </div>
          <section className="rack-order-card">
            <h3 className="rack-eyebrow rack-order-card-head">Customer</h3>
            <span className="rack-sk" style={{ height: 11, width: "60%", display: "block" }} />
            <span
              className="rack-sk d1"
              style={{ height: 11, width: "75%", display: "block", marginTop: 8 }}
            />
          </section>
          <section className="rack-order-card">
            <h3 className="rack-eyebrow rack-order-card-head">Ship to</h3>
            <span className="rack-sk d2" style={{ height: 11, width: "80%", display: "block" }} />
            <span
              className="rack-sk d3"
              style={{ height: 11, width: "55%", display: "block", marginTop: 8 }}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
