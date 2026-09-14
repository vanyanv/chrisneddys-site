import Link from "next/link";
import { listProductsForAdmin, type AdminProductListRow } from "@/lib/catalogAdmin";
import { NewProductForm } from "./NewProductForm";

export const dynamic = "force-dynamic";

type Status = "all" | "published" | "draft" | "archived";

const TABS: { key: Status; label: string }[] = [
  { key: "all", label: "All" },
  { key: "published", label: "Published" },
  { key: "draft", label: "Draft" },
  { key: "archived", label: "Archived" },
];

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** "2h ago" / "3d ago" / "just now", coarse on purpose — this is a glance
 * column, not an audit log. */
function relativeTime(date: Date): string {
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 45) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function InventoryCell({ inventory }: { inventory: AdminProductListRow["inventory"] }) {
  if (inventory.mode === "untracked") {
    return <span className="adm-inv-untracked">Untracked</span>;
  }
  if (inventory.mode === "quantity") {
    return <span>{inventory.quantity === 0 ? "Sold out" : inventory.quantity}</span>;
  }
  const { available, editionSize } = inventory;
  const ratio = editionSize > 0 ? available / editionSize : 0;
  return (
    <div className="adm-inv-edition">
      <span>{available === 0 ? "Sold out" : `${available} of ${editionSize}`}</span>
      <div className="adm-inv-bar" aria-hidden="true">
        <span style={{ width: `${ratio * 100}%` }} />
      </div>
    </div>
  );
}

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: rawStatus } = await searchParams;
  const status: Status = TABS.some((t) => t.key === rawStatus) ? (rawStatus as Status) : "all";

  const allRows = await listProductsForAdmin();
  const rows = status === "all" ? allRows : allRows.filter((r) => r.status === status);

  return (
    <>
      <div className="adm-products-head">
        <h1 className="adm-h1">Products</h1>
        <NewProductForm />
      </div>

      <nav className="adm-tabs" aria-label="Filter by status">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={tab.key === "all" ? "/admin/products" : `/admin/products?status=${tab.key}`}
            className="adm-tab"
            aria-current={status === tab.key ? "page" : undefined}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <div className="adm-table-wrap">
          <p className="adm-empty">No products here yet.</p>
        </div>
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Photo</th>
                <th>Product</th>
                <th>Status</th>
                <th>Price</th>
                <th>Inventory</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <Link href={`/admin/products/${row.id}`} className="adm-row-link">
                      {row.thumbUrl ? (
                        <img
                          className="adm-thumb"
                          src={row.thumbUrl}
                          alt=""
                          width={40}
                          height={40}
                        />
                      ) : (
                        <span className="adm-thumb adm-thumb-empty" aria-hidden="true" />
                      )}
                    </Link>
                  </td>
                  <td>
                    <Link href={`/admin/products/${row.id}`} className="adm-row-link">
                      <span className="adm-product-name">{row.name}</span>
                      <span className="adm-product-slug">/{row.slug}</span>
                    </Link>
                  </td>
                  <td>
                    <span className="adm-chip" data-status={row.status}>
                      {row.status}
                    </span>
                  </td>
                  <td>{formatPrice(row.priceCents)}</td>
                  <td>
                    <InventoryCell inventory={row.inventory} />
                  </td>
                  <td>{relativeTime(row.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
