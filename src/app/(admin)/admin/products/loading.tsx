import "@/styles/admin-rack.css";

/**
 * `/admin/products`'s loading skeleton (`ProductsLoading.dc.html`, issue #36
 * phase 2) — Next renders this in place of the page while `page.tsx`'s
 * `requireOwner()` and catalogue reads are in flight, so nothing here can
 * know the real session or store-open state yet. The mockup keeps the top
 * bar's avatar and "Store: Open" pill fully rendered for illustration; this
 * skeletons them instead, on the same honesty rule the rest of The Rack
 * follows (real data or a skeleton, never a guess) — everything else
 * (cards, the detail panel, the edition grid) follows the mockup as drawn.
 */
/** Cycles through the skeleton's 4-step stagger (`""`, `d1`, `d2`, `d3`) so a
 * row of skeleton pieces breathes slightly out of phase with its neighbours,
 * same as `Motion.dc.html`'s reference sheet. */
function skDelay(i: number): string {
  const step = i % 4;
  return step === 0 ? "rack-sk" : `rack-sk d${step}`;
}

export default function ProductsLoading() {
  return (
    <div className="rack-root">
      <nav className="rack-topbar" aria-label="Admin sections">
        <span className="rack-sk" style={{ height: 22, width: 140, display: "block" }} />
        <div className="rack-tabs">
          <span className="rack-tab" aria-current="false">
            Overview
          </span>
          <span className="rack-tab" aria-current="page">
            Products
          </span>
          <span className="rack-tab" aria-current="false">
            Orders
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
          <h1 className="rack-page-title rack-bow">Products</h1>
        </div>
        <div className="rack-page-header-right">
          <span className="rack-sk" style={{ height: 11, width: 130, display: "block" }} />
          <button type="button" className="rack-btn-primary" style={{ opacity: 0.55 }} disabled>
            <svg aria-hidden="true" className="rack-icon" viewBox="0 0 16 16">
              <path d="M8 3v10M3 8h10" />
            </svg>
            New product
          </button>
        </div>
      </div>

      <div className="rack-content">
        <div className="rack-grid">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rack-card" style={{ cursor: "default" }}>
              <div className={skDelay(i)} style={{ aspectRatio: 1 }} />
              <div className="rack-card-body">
                <div className={skDelay(i)} style={{ height: 14, width: "82%" }} />
                <div className={skDelay(i)} style={{ height: 14, width: "54%", marginTop: 7 }} />
                <div className={skDelay(i)} style={{ height: 11, width: "38%", marginTop: 12 }} />
                <div className={skDelay(i)} style={{ height: 4, width: "100%", marginTop: 9 }} />
              </div>
            </div>
          ))}
        </div>

        <aside className="rack-detail">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="rack-sk" style={{ width: 40, height: 40, flex: "none" }} />
            <div style={{ flex: 1 }}>
              <div className="rack-sk" style={{ height: 15, width: "88%" }} />
              <div className="rack-sk d1" style={{ height: 11, width: "56%", marginTop: 7 }} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 15 }}>
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={skDelay(i)} style={{ width: 56, height: 56 }} />
            ))}
          </div>
          <div className="rack-hairline">
            <div className="rack-sk d2" style={{ height: 10, width: 120 }} />
            <div className="rack-edgrid" style={{ marginTop: 13 }}>
              {Array.from({ length: 50 }, (_, i) => (
                <span key={i} className={skDelay(i)} style={{ aspectRatio: 1 }} />
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
