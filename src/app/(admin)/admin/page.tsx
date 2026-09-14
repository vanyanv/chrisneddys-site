import { getDb } from "@/db/client";
import { products } from "@/db/schema";
import { isAuthConfigured } from "@/lib/auth";

export const dynamic = "force-dynamic";

type StatusCounts = Record<"draft" | "published" | "archived", number>;

async function loadStatusCounts(): Promise<StatusCounts> {
  const db = await getDb();
  const rows = await db.select({ status: products.status }).from(products);
  const counts: StatusCounts = { draft: 0, published: 0, archived: 0 };
  for (const row of rows) counts[row.status] += 1;
  return counts;
}

const SETUP_ITEMS: { label: string; ok: boolean }[] = [
  { label: "Database connected (DATABASE_URL)", ok: Boolean(process.env.DATABASE_URL) },
  { label: "Owner sign-in", ok: isAuthConfigured() },
  {
    label: "Photo storage (BLOB_READ_WRITE_TOKEN)",
    ok: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
  },
  { label: "Payments (STRIPE_SECRET_KEY)", ok: Boolean(process.env.STRIPE_SECRET_KEY) },
  { label: "Email (RESEND_API_KEY)", ok: Boolean(process.env.RESEND_API_KEY) },
];

export default async function AdminDashboardPage() {
  const counts = await loadStatusCounts();
  const total = counts.draft + counts.published + counts.archived;

  return (
    <>
      <h1 className="adm-h1">The counter.</h1>
      <div className="adm-grid">
        <div className="adm-card">
          <span className="adm-label">Products</span>
          <div className="adm-card-num">{total}</div>
          <p style={{ margin: 0, fontSize: 13, color: "var(--a-sub)" }}>
            {counts.published} published · {counts.draft} draft · {counts.archived} archived
          </p>
        </div>

        <div className="adm-card">
          <span className="adm-label">Orders</span>
          <div className="adm-card-num" style={{ fontSize: 20 }}>
            Not open yet
          </div>
        </div>

        <div className="adm-card">
          <span className="adm-label">Setup checklist</span>
          <ul className="adm-checklist" style={{ marginTop: 12 }}>
            {SETUP_ITEMS.map((item) => (
              <li key={item.label}>
                <span className="adm-check-icon" data-ok={item.ok}>
                  {item.ok ? "✓" : "–"}
                </span>
                {item.label}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
