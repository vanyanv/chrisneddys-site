import "@/styles/admin-rack.css";
import { SkeletonHoldBack } from "@/components/admin/SkeletonHoldBack";

/**
 * `/admin/products/[id]/run`'s ("All fifty numbers") loading skeleton
 * (issue #36 phase 5, "Motion & loading") — shown while `page.tsx`'s
 * `requireOwner()` and its `getRunForAdmin`/`getStoreSettings` reads are in
 * flight. Mirrors `RunBoard`'s own two-column layout: the full number grid
 * and held list on the left, the detail panel on the right.
 *
 * The top bar, tab strip, the back-link and "The run" title render
 * immediately, so a slow connection still gets a stable frame instead of a
 * blank viewport for 200ms (issue #46 follow-up). The one exception to
 * "back-link is chrome": on the real page the back-link's own text is the
 * product's title, not a fixed label like "All orders" is on the order
 * detail page — genuinely unknown until the read resolves. Splitting it
 * from the header it sits above would mean either delaying it alone (which
 * then jumps the header down when it appears) or reordering the tree, so
 * it renders with the rest of the stable frame instead, the same trade the
 * top bar's own avatar/store-pill make. The board's own "N sold" line
 * (`.rack-page-count`) is a fact separable from the title, so it gets its
 * own small hold rather than jumping in ahead of the number grid below.
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
            Customers
          </span>
          <span className="rack-tab" aria-current="false">
            Settings
          </span>
        </div>
        <div className="rack-top-right">
          <SkeletonHoldBack>
            <span className="rack-sk" style={{ height: 22, width: 96 }} />
            <span className="rack-sk" style={{ width: 28, height: 28, borderRadius: 999 }} />
          </SkeletonHoldBack>
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
          <SkeletonHoldBack>
            <span className="rack-sk" style={{ height: 11, width: 140 }} />
          </SkeletonHoldBack>
        </div>
      </div>

      <SkeletonHoldBack>
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
      </SkeletonHoldBack>
    </div>
  );
}
