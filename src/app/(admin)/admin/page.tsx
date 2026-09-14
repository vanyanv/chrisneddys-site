import Link from "next/link";
import { getDb } from "@/db/client";
import { products } from "@/db/schema";
import { getOrdersDashboardCounts } from "@/lib/ordersAdmin";
import { getSetupChecklist } from "@/lib/setupChecklist";

export const dynamic = "force-dynamic";

type StatusCounts = Record<"draft" | "published" | "archived", number>;

async function loadStatusCounts(): Promise<StatusCounts> {
  const db = await getDb();
  const rows = await db.select({ status: products.status }).from(products);
  const counts: StatusCounts = { draft: 0, published: 0, archived: 0 };
  for (const row of rows) counts[row.status] += 1;
  return counts;
}

export default async function AdminDashboardPage() {
  const setupItems = getSetupChecklist();
  const [counts, orderCounts] = await Promise.all([loadStatusCounts(), getOrdersDashboardCounts()]);
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
          <span className="adm-label">Orders — to fulfil</span>
          <div className="adm-card-num">{orderCounts.toFulfil}</div>
          <p style={{ margin: 0, fontSize: 13, color: "var(--a-sub)" }}>
            {orderCounts.readyForPickup} ready for pickup · {orderCounts.fulfilledThisWeek}{" "}
            fulfilled this week
          </p>
          <Link
            href="/admin/orders"
            className="adm-btn"
            style={{ marginTop: 10, display: "inline-block" }}
          >
            View orders →
          </Link>
        </div>

        <div className="adm-card">
          <span className="adm-label">Setup checklist</span>
          <ul className="adm-checklist" style={{ marginTop: 12 }}>
            {setupItems.map((item) => (
              <li key={item.key}>
                <span className="adm-check-icon" data-ok={item.ok}>
                  {item.ok ? "✓" : "–"}
                </span>
                {item.label}
                {!item.ok && item.detail && <span className="adm-help"> — {item.detail}</span>}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
