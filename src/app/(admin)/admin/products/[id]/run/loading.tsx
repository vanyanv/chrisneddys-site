import "@/styles/admin-rack.css";

/**
 * `/admin/products/[id]/run`'s ("All fifty numbers") loading skeleton
 * (issue #36 phase 5, "Motion & loading") — shown while `page.tsx`'s
 * `requireOwner()` and its `getRunForAdmin`/`getStoreSettings` reads are in
 * flight. Mirrors `RunBoard`'s own two-column layout: the full number grid
 * and held list on the left, the detail panel on the right.
 */
function skDelay(i: number): string {
  const step = i % 4;
  return step === 0 ? "rack-sk" : `rack-sk d${step}`;
}

export default function RunLoading() {
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
            Settings
          </span>
        </div>
        <div className="rack-top-right">
          <span className="rack-sk" style={{ height: 22, width: 96 }} />
          <span className="rack-sk" style={{ width: 28, height: 28, borderRadius: 999 }} />
        </div>
      </nav>

      <div style={{ padding: "18px 22px 0" }}>
        <span className="rack-sk" style={{ height: 13, width: 120, display: "block" }} />
      </div>

      <div className="rack-page-header" style={{ paddingTop: 11 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 13, flexWrap: "wrap" }}>
          <h1 className="rack-page-title rack-bow" style={{ fontSize: 40 }}>
            The run
          </h1>
          <span className="rack-sk" style={{ height: 11, width: 140 }} />
        </div>
      </div>

      <div className="rack-order-grid">
        <div className="rack-order-main">
          <section className="rack-order-card">
            <h3 className="rack-eyebrow rack-order-card-head">Every number, and where it went</h3>
            <div className="run-board-grid" role="presentation">
              {Array.from({ length: 50 }, (_, i) => (
                <span key={i} className={skDelay(i)} style={{ aspectRatio: 1 }} />
              ))}
            </div>
          </section>
          <section className="rack-order-card">
            <h3 className="rack-eyebrow rack-order-card-head">Held right now</h3>
            <span className="rack-sk" style={{ height: 11, width: "70%", display: "block" }} />
          </section>
        </div>

        <div className="rack-order-side">
          <div className="rack-panel">
            <h3 className="rack-eyebrow rack-order-card-head">Pick a number</h3>
            <span className="rack-sk" style={{ height: 11, width: "80%", display: "block" }} />
          </div>
        </div>
      </div>
    </div>
  );
}
