import type { AdminProduct } from "@/lib/catalogAdmin";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function StatusCard({ product }: { product: AdminProduct }) {
  return (
    <div className="adm-card">
      <h2 className="adm-h2">Status</h2>
      <dl className="adm-status-list">
        <div>
          <dt>Status</dt>
          <dd>
            <span className="adm-chip" data-status={product.status}>
              {product.status}
            </span>
          </dd>
        </div>
        <div>
          <dt>Created</dt>
          <dd>{dateFormatter.format(product.createdAt)}</dd>
        </div>
        <div>
          <dt>Updated</dt>
          <dd>{dateFormatter.format(product.updatedAt)}</dd>
        </div>
        <div>
          <dt>Published</dt>
          <dd>{product.publishedAt ? dateFormatter.format(product.publishedAt) : "—"}</dd>
        </div>
        <div>
          <dt>Product ID</dt>
          <dd className="adm-mono-value">{product.id}</dd>
        </div>
        <div>
          <dt>SKU</dt>
          <dd className="adm-mono-value">{product.sku ?? "—"}</dd>
        </div>
      </dl>
    </div>
  );
}
