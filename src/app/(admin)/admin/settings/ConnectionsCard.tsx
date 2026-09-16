import { isEmailConfigured } from "@/lib/email";
import { getSetupChecklist, webhookUrl } from "@/lib/setupChecklist";
import { CopyButton } from "./CopyButton";

/**
 * A one-line, genuinely-known detail for a connection that IS configured —
 * shown next to its "Connected" pill. Nothing here is a count or timestamp
 * this app doesn't actually record (no webhook-delivery log, no blob file
 * listing) — only a fact an env var already states outright, so it can
 * never drift into a lie the way a hand-written "verified 4 min ago" would.
 * `null` means there's nothing more honest to add than the pill itself.
 *
 * `email`'s row defers to `isEmailConfigured()` (`@/lib/email`) rather than
 * reading `RESEND_API_KEY`/`EMAIL_FROM` here itself, so there's exactly one
 * definition of "is email configured" for `sendEmail` and this card to
 * agree on.
 */
function okDetail(key: string): string | null {
  switch (key) {
    case "payments": {
      const secretKey = process.env.STRIPE_SECRET_KEY ?? "";
      if (secretKey.startsWith("sk_live_")) return "Live keys";
      if (secretKey.startsWith("sk_test_")) return "Test keys";
      return null;
    }
    case "database":
      return process.env.DATABASE_URL ? "Neon" : null;
    case "email":
      return isEmailConfigured() ? `Sends as ${process.env.EMAIL_FROM}` : null;
    default:
      return null;
  }
}

/** The Connections section — a hairline list of status dots (green = ok,
 * muted = missing env vars) plus the Stripe webhook URL. Rendered as a
 * plain section inside `SettingsForm`'s grid, same as Store/Pickup/
 * Shipping/Policies (no card border/shadow). Every row gets a "Connected"
 * pill once it's ok, and a detail line whenever there's a genuine fact to
 * show — broken or fixed, this never shows more than the checklist (or an
 * env var it reads directly, see `okDetail`) actually backs up. */
export function ConnectionsCard() {
  const items = getSetupChecklist();

  return (
    <>
      <h2 className="adm-group-label">Connections</h2>
      <ul className="adm-conn-list">
        {items.map((item) => {
          const detail = item.ok ? okDetail(item.key) : item.detail || null;
          return (
            <li key={item.key} className="adm-conn-item">
              <span className={`adm-conn-dot${item.ok ? " is-ok" : ""}`} aria-hidden="true" />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="adm-conn-label">{item.label}</span>
                {detail && <span className="adm-conn-detail">{detail}</span>}
              </span>
              {item.ok && <span className="adm-pill is-live">Connected</span>}
            </li>
          );
        })}
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
