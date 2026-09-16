import "@/styles/admin-rack.css";
import "@/styles/admin-settings.css";

/**
 * `/admin/settings`'s loading skeleton (issue #36 phase 5, "Motion &
 * loading") — shown while `page.tsx`'s `requireOwner()` and its
 * `getSettingsForAdmin`/`listOwners`/`getStoreSettings` reads are in
 * flight. Mirrors the real page's wayfinding column plus the shop card at
 * the top of the settings content, same convention as the rest of The
 * Rack's loading states.
 */
function skDelay(i: number): string {
  const step = i % 4;
  return step === 0 ? "rack-sk" : `rack-sk d${step}`;
}

const SETTINGS_NAV = [
  "The shop",
  "Shipping",
  "Policies",
  "Connections",
  "Owners",
  "Sign-in & passkeys",
];

export default function SettingsLoading() {
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
            Settings
          </span>
        </div>
        <div className="rack-top-right">
          <span className="rack-sk" style={{ height: 22, width: 96 }} />
          <span className="rack-sk" style={{ width: 28, height: 28, borderRadius: 999 }} />
        </div>
      </nav>

      <div className="rack-settings-body">
        <nav className="rack-settings-nav" aria-label="Settings sections">
          {SETTINGS_NAV.map((label, i) => (
            <span key={label} className={i === 0 ? "is-active" : ""} aria-hidden="true">
              <span className={skDelay(i)} style={{ height: 11, width: 60 + (i % 3) * 20 }} />
            </span>
          ))}
        </nav>

        <div className="rack-settings-content">
          <div className="rack-settings-shop-card">
            <span className="rack-sk" style={{ width: 46, height: 46, flex: "none" }} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
              <span className="rack-sk d1" style={{ height: 15, width: "40%" }} />
              <span className="rack-sk d2" style={{ height: 11, width: "60%" }} />
            </div>
          </div>
          {[0, 1, 2].map((i) => (
            <div key={i} className="rack-panel">
              <span className={skDelay(i)} style={{ height: 13, width: "25%", display: "block" }} />
              <span
                className={skDelay(i + 1)}
                style={{ height: 11, width: "90%", display: "block", marginTop: 12 }}
              />
              <span
                className={skDelay(i + 2)}
                style={{ height: 11, width: "70%", display: "block", marginTop: 8 }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
