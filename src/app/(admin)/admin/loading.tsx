import "@/styles/admin-rack.css";

/**
 * `/admin`'s ("Today") loading skeleton (issue #36 phase 5, "Motion &
 * loading") — Next renders this while `page.tsx`'s `requireOwner()` and its
 * `Promise.all` of settings/stats/queue/activity reads are in flight, so
 * nothing here can know the real session, store-open state, or queue
 * contents yet. Same honesty rule `admin/products/loading.tsx` set for this
 * app: real data or a skeleton, never a guess. Structure mirrors
 * `page.tsx`'s render as drawn — the top bar, the stat row, the queue, and
 * the run/activity side panel.
 */
function skDelay(i: number): string {
  const step = i % 4;
  return step === 0 ? "rack-sk" : `rack-sk d${step}`;
}

export default function TodayLoading() {
  return (
    <div className="rack-root">
      <nav className="rack-topbar" aria-label="Admin sections">
        <span className="rack-sk" style={{ height: 22, width: 140, display: "block" }} />
        <div className="rack-tabs">
          <span className="rack-tab" aria-current="page">
            Overview
          </span>
          <span className="rack-tab" aria-current="false">
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
          <span className="rack-sk" style={{ height: 10, width: 130, display: "block" }} />
          <h1 className="rack-page-title rack-bow" style={{ marginTop: 9 }}>
            Today
          </h1>
        </div>
        <div className="rack-page-header-right">
          <span className="rack-sk" style={{ height: 11, width: 150 }} />
        </div>
      </div>

      <div className="rack-stats">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rack-stat-card">
            <div className="rack-eyebrow">
              {i === 0 ? "Money in today" : i === 1 ? "To pack" : "Left of the run"}
            </div>
            <div className={skDelay(i)} style={{ height: 30, width: "62%", marginTop: 7 }} />
            <div className={skDelay(i + 1)} style={{ height: 11, width: "48%", marginTop: 9 }} />
          </div>
        ))}
      </div>

      <div className="rack-today-grid">
        <section className="rack-queue">
          <div className="rack-queue-head">
            <span className="rack-eyebrow">Needs you</span>
          </div>
          {[0, 1, 2].map((i) => (
            <div key={i} className={`rack-queue-item rack-rise r${i + 1}`}>
              <span className="rack-queue-icon">
                <span className={skDelay(i)} style={{ width: 16, height: 16, display: "block" }} />
              </span>
              <div className="rack-queue-body">
                <div className={skDelay(i)} style={{ height: 14, width: "70%" }} />
                <div
                  className={skDelay(i + 1)}
                  style={{ height: 11, width: "45%", marginTop: 6 }}
                />
              </div>
              <span className={skDelay(i + 2)} style={{ height: 34, width: 96 }} />
            </div>
          ))}
        </section>

        <aside className="rack-side">
          <div className="rack-panel">
            <div className="rack-panel-head">
              <span className="rack-eyebrow">The run</span>
              <span className={skDelay(1)} style={{ height: 10, width: 70 }} />
            </div>
            <div className="rack-edgrid">
              {Array.from({ length: 50 }, (_, i) => (
                <span key={i} className={skDelay(i)} style={{ aspectRatio: 1 }} />
              ))}
            </div>
          </div>

          <div className="rack-panel" style={{ flex: 1, minHeight: 0 }}>
            <span className="rack-eyebrow">Just happened</span>
            <div className="rack-activity" style={{ marginTop: 13 }}>
              {[0, 1, 2].map((i) => (
                <div key={i} className="rack-activity-row">
                  <span className={skDelay(i)} style={{ height: 11, width: 44 }} />
                  <span className={skDelay(i + 1)} style={{ height: 11, width: "70%" }} />
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
