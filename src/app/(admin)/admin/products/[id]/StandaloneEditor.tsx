"use client";

import { useRouter } from "next/navigation";
import type { AdminProduct } from "@/lib/catalogAdmin";
import { archiveProductAction, duplicateProductAction } from "../actions";
import { ProductEditor } from "../ProductEditor";
import { Toast } from "../Toast";
import { usePendingChanges } from "../usePendingChanges";

/** `/admin/products/[id]` — the full-page version of the sheet's expanded
 * row: same `ProductEditor`, its own `usePendingChanges` instance (so its
 * Save bar covers only this product), a smaller "···" menu (Duplicate,
 * Archive — no Move up/down or "Open full editor", both meaningless from
 * inside the full editor already). */
export function StandaloneEditor({
  product,
  blobConfigured,
}: {
  product: AdminProduct;
  blobConfigured: boolean;
}) {
  const router = useRouter();
  const pendingApi = usePendingChanges(() => router.refresh());

  async function duplicate() {
    const result = await duplicateProductAction(product.id);
    if (!result.ok) {
      pendingApi.showToast(result.error, { tone: "error" });
      return;
    }
    router.push(`/admin/products/${result.id}`);
  }

  async function archive() {
    const result = await archiveProductAction(product.id);
    if (!result.ok) {
      pendingApi.showToast(result.error, { tone: "error" });
      return;
    }
    router.push("/admin/products");
  }

  return (
    <>
      <div className="adm-row-expand-grid">
        <ProductEditor
          product={product}
          pendingApi={pendingApi}
          blobConfigured={blobConfigured}
          menuActions={[
            { key: "dup", label: "Duplicate", onClick: () => void duplicate() },
            { key: "archive", label: "Archive", onClick: () => void archive() },
          ]}
        />
      </div>

      <div className={`adm-savebar${pendingApi.pendingCount > 0 ? " is-visible" : ""}`}>
        <span className="adm-savebar-count">
          {pendingApi.pendingCount} change{pendingApi.pendingCount === 1 ? "" : "s"}
        </span>
        <button type="button" className="adm-savebar-discard" onClick={pendingApi.discardAll}>
          Discard
        </button>
        <button
          type="button"
          className="adm-savebar-save"
          disabled={pendingApi.saving}
          onClick={() => void pendingApi.save()}
        >
          {pendingApi.saving ? "Saving…" : "Save"}
        </button>
      </div>

      <Toast toast={pendingApi.toast} onDismiss={pendingApi.dismissToast} />
    </>
  );
}
