import { isAuthConfigured } from "@/lib/auth";

/** Mirrors the dashboard's own setup checklist (`src/app/(admin)/admin/page.tsx`)
 * — same env-presence checks, read-only, plus the one URL Stripe's dashboard
 * needs pasted into it. Nothing here is a form: these are read from
 * `process.env` at request time, not stored settings. */
const CHECKLIST: { label: string; ok: boolean }[] = [
  { label: "Database connected (DATABASE_URL)", ok: Boolean(process.env.DATABASE_URL) },
  { label: "Owner sign-in", ok: isAuthConfigured() },
  {
    label: "Photo storage (BLOB_READ_WRITE_TOKEN)",
    ok: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
  },
  { label: "Payments (STRIPE_SECRET_KEY)", ok: Boolean(process.env.STRIPE_SECRET_KEY) },
  { label: "Email (RESEND_API_KEY)", ok: Boolean(process.env.RESEND_API_KEY) },
];

const WEBHOOK_URL = "https://www.chrisneddys.com/api/stripe/webhook";

export function ConnectionsCard() {
  return (
    <div className="adm-card">
      <h2 className="adm-h2">Connections</h2>
      <ul className="adm-checklist">
        {CHECKLIST.map((item) => (
          <li key={item.label}>
            <span className="adm-check-icon" data-ok={item.ok}>
              {item.ok ? "✓" : "–"}
            </span>
            {item.label}
          </li>
        ))}
      </ul>

      <p className="adm-label" style={{ marginTop: 16 }}>
        Stripe webhook URL
      </p>
      <p className="adm-mono-value">{WEBHOOK_URL}</p>
      <p className="adm-help">
        Paste this into the Stripe dashboard (Developers → Webhooks) as the endpoint URL.
      </p>
    </div>
  );
}
