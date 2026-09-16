import "@/styles/admin-rack.css";
import "@/styles/admin-customers.css";
import { SkeletonHoldBack } from "@/components/admin/SkeletonHoldBack";

/**
 * `/admin/customers`'s loading skeleton (issue #36 phase 7) — shown while
 * `page.tsx`'s `requireOwner()` and `listCustomersForAdmin`/
 * `getStoreSettings` reads are in flight. Same skeleton convention as
 * `admin/orders/loading.tsx`: real data or a skeleton, never a guess.
 *
 * The top bar, tab strip and "Customers" title render immediately — they
 * don't wait on the customer list read, so holding them back traded a
 * skeleton flash for a blank-screen one on a slow connection (issue #46
 * follow-up). The count line and the table sit behind
 * `<SkeletonHoldBack>`.
 */
function skDelay(i: number): string {
  const step = i % 4;
  return step === 0 ? "rack-sk" : `rack-sk d${step}`;
}

export default function CustomersLoading() {
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
          <SkeletonHoldBack>
            <span className="rack-sk" style={{ height: 22, width: 96 }} />
            <span className="rack-sk" style={{ width: 28, height: 28, borderRadius: 999 }} />
          </SkeletonHoldBack>
        </div>
      </nav>

      <div className="rack-page-header">
        <div>
          <h1 className="rack-page-title rack-bow">Customers</h1>
        </div>
        <div className="rack-page-header-right">
          <SkeletonHoldBack>
            <span className="rack-sk" style={{ height: 11, width: 90 }} />
          </SkeletonHoldBack>
        </div>
      </div>

      <SkeletonHoldBack>
        <div style={{ padding: "0 22px 22px" }}>
          <div className="cust-sheet">
            <div className="cust-cols" role="presentation">
              <span>Name</span>
              <span>Email</span>
              <span>Orders</span>
              <span>Spent</span>
              <span>First bought</span>
              <span>Sent back</span>
            </div>
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="cust-row" style={{ cursor: "default" }}>
                <span className={skDelay(i)} style={{ height: 12, width: "60%" }} />
                <span className={skDelay(i + 1)} style={{ height: 11, width: "70%" }} />
                <span className={skDelay(i + 2)} style={{ height: 11, width: 20 }} />
                <span className={skDelay(i)} style={{ height: 11, width: 44 }} />
                <span className={skDelay(i + 1)} style={{ height: 11, width: 50 }} />
                <span className={skDelay(i + 2)} style={{ height: 11, width: 20 }} />
              </div>
            ))}
          </div>
        </div>
      </SkeletonHoldBack>
    </div>
  );
}
