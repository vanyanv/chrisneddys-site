import { getSetupChecklist, webhookUrl } from "@/lib/setupChecklist";
import { CopyButton } from "./CopyButton";

/** The Connections section — a hairline list of status dots (green = ok,
 * muted = missing env vars) plus the Stripe webhook URL. Rendered as a
 * plain section inside `SettingsForm`'s grid, same as Store/Pickup/
 * Shipping/Policies (no card border/shadow). */
export function ConnectionsCard() {
  const items = getSetupChecklist();

  return (
    <>
      <h2 className="adm-group-label">Connections</h2>
      <ul className="adm-conn-list">
        {items.map((item) => (
          <li key={item.key} className="adm-conn-item">
            <span className={`adm-conn-dot${item.ok ? " is-ok" : ""}`} aria-hidden="true" />
            <span>
              <span className="adm-conn-label">{item.label}</span>
              {!item.ok && item.detail && <span className="adm-conn-detail">{item.detail}</span>}
            </span>
          </li>
        ))}
      </ul>

      <div className="adm-conn-webhook">
        <p className="adm-label">Stripe webhook URL</p>
        <div className="adm-webhook-row">
          <input
            type="text"
            readOnly
            value={webhookUrl}
            aria-label="Stripe webhook URL"
            className="adm-input adm-mono-field"
          />
          <CopyButton value={webhookUrl} />
        </div>
        <p className="adm-help">
          Paste this into the Stripe dashboard (Developers → Webhooks) as the endpoint URL.
        </p>
      </div>
    </>
  );
}
