import { getSetupChecklist, webhookUrl } from "@/lib/setupChecklist";

export function ConnectionsCard() {
  const items = getSetupChecklist();

  return (
    <div className="adm-card">
      <h2 className="adm-h2">Connections</h2>
      <ul className="adm-checklist">
        {items.map((item) => (
          <li key={item.key}>
            <span className="adm-check-icon" data-ok={item.ok}>
              {item.ok ? "✓" : "–"}
            </span>
            {item.label}
            {!item.ok && item.detail && <span className="adm-help"> — {item.detail}</span>}
          </li>
        ))}
      </ul>

      <p className="adm-label" style={{ marginTop: 16 }}>
        Stripe webhook URL
      </p>
      <p className="adm-mono-value">{webhookUrl}</p>
      <p className="adm-help">
        Paste this into the Stripe dashboard (Developers → Webhooks) as the endpoint URL.
      </p>
    </div>
  );
}
