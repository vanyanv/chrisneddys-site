import { ADMIN_NAV } from "@/app/(admin)/admin/adminNav";
import { SkeletonHoldBack } from "@/components/admin/SkeletonHoldBack";
import "@/styles/admin-rack.css";
import "@/styles/admin-closing.css";

/** Shared skeleton for the closing pages: the stable frame, then bars. */
export default function ClosingLoading() {
  return (
    <div className="rack-root">
      <nav className="rack-topbar" aria-label="Admin sections">
        <span className="rack-sk" style={{ height: 22, width: 140, display: "block" }} />
        <div className="rack-tabs">
          {ADMIN_NAV.map((item) => (
            <span
              key={item.href}
              className="rack-tab"
              aria-current={item.href === "/admin/closing" ? "page" : "false"}
            >
              {item.label}
            </span>
          ))}
        </div>
      </nav>
      <div className="rack-page-header">
        <h1 className="rack-page-title rack-bow">Closing</h1>
      </div>
      <div className="clo-body">
        <SkeletonHoldBack>
          {[0, 1, 2].map((i) => (
            <span key={i} className="rack-sk" style={{ height: 72, display: "block" }} />
          ))}
        </SkeletonHoldBack>
      </div>
    </div>
  );
}
