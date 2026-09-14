import { desc } from "drizzle-orm";
import { getDb } from "@/db/client";
import { products } from "@/db/schema";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

async function loadProducts() {
  const db = await getDb();
  return db
    .select({
      id: products.id,
      name: products.name,
      status: products.status,
      priceCents: products.priceCents,
      updatedAt: products.updatedAt,
    })
    .from(products)
    .orderBy(desc(products.updatedAt));
}

/**
 * Read-only listing. The full editor (create/edit/publish) is another
 * worker's job — this table is here so that work has something to extend.
 */
export default async function AdminProductsPage() {
  const rows = await loadProducts();

  return (
    <>
      <h1 className="adm-h1">Products</h1>
      {rows.length === 0 ? (
        <div className="adm-table-wrap">
          <p className="adm-empty">No products yet.</p>
        </div>
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Price</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td>
                    <span className="adm-chip" data-status={row.status}>
                      {row.status}
                    </span>
                  </td>
                  <td>{formatPrice(row.priceCents)}</td>
                  <td>{dateFormatter.format(row.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
