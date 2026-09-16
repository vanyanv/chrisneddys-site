"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminProduct, AdminProductListRow } from "@/lib/catalogAdmin";
import {
  archiveProductAction,
  createBlankProductAction,
  duplicateProductAction,
  loadProductForPanelAction,
  reorderProductsAction,
  restoreProductAction,
  setProductStatusAction,
} from "./actions";
import { RackProductPanel } from "./RackProductPanel";
import type { RowMenuAction } from "./RowMenu";
import { Toast } from "./Toast";
import { formatPrice, productTitle } from "./format";
import { usePendingChanges } from "./usePendingChanges";

const MOBILE_QUERY = "(max-width: 719px)";

function CardMeta({ row }: { row: AdminProductListRow }) {
  if (row.inventory.mode === "untracked") {
    return <div className="rack-card-meta">Not tracked</div>;
  }
  if (row.inventory.mode === "quantity") {
    if (row.inventory.quantity === 0) {
      return <div className="rack-card-meta is-hot">Sold out</div>;
    }
    return <div className="rack-card-meta">{row.inventory.quantity} in stock</div>;
  }
  // edition
  const { available, editionSize, reserved } = row.inventory;
  if (available === 0) {
    return <div className="rack-card-meta is-hot">Sold out</div>;
  }
  const heldNote = reserved > 0 ? ` · ${reserved} held` : "";
  return (
    <div className={`rack-card-meta${available <= 3 ? " is-hot" : ""}`}>
      {available} of {editionSize} left{heldNote}
    </div>
  );
}

function CardBar({ row }: { row: AdminProductListRow }) {
  if (row.inventory.mode !== "edition") return null;
  const ratio =
    row.inventory.editionSize > 0 ? row.inventory.available / row.inventory.editionSize : 0;
  return (
    <div className="rack-edbar">
      <i style={{ width: `${Math.max(0, Math.min(100, ratio * 100))}%` }} />
    </div>
  );
}

function ProductCard({
  row,
  isOpen,
  onOpen,
}: {
  row: AdminProductListRow;
  isOpen: boolean;
  onOpen: () => void;
}) {
  const title = productTitle(row.displayName1, row.displayName2);
  return (
    <button
      type="button"
      className={`rack-card${isOpen ? " is-open" : ""}`}
      data-slug={row.slug}
      data-id={row.id}
      data-testid="product-card"
      onClick={onOpen}
    >
      <div className="rack-card-photo">
        {row.thumbUrl ? (
          <img src={row.thumbUrl} alt="" />
        ) : (
          <span className="rack-eyebrow">No photo yet</span>
        )}
        <span
          className={`rack-pill${
            row.status === "published" ? " is-live" : row.status === "draft" ? " is-warn" : ""
          }`}
        >
          {row.status === "published" ? "Live" : "Draft"}
        </span>
      </div>
      <div className="rack-card-body">
        <div className={`rack-bow rack-card-title${title ? "" : " is-empty"}`}>
          {title || "No name yet"}
        </div>
        <div className="rack-card-price rack-mono">{formatPrice(row.priceCents)}</div>
        <CardMeta row={row} />
        <CardBar row={row} />
      </div>
    </button>
  );
}

export function RackCatalogue({
  rows: initialRows,
  archived: initialArchived,
  blobConfigured,
  openId: initialOpenId,
}: {
  rows: AdminProductListRow[];
  archived: AdminProductListRow[];
  blobConfigured: boolean;
  openId: string | null;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [archived, setArchived] = useState(initialArchived);
  useEffect(() => setRows(initialRows), [initialRows]);
  useEffect(() => setArchived(initialArchived), [initialArchived]);

  const [search, setSearch] = useState("");
  const [liveOnly, setLiveOnly] = useState(false);
  const [openId, setOpenId] = useState(initialOpenId);
  const [mountedId, setMountedId] = useState(initialOpenId);
  const [productCache, setProductCache] = useState<Record<string, AdminProduct>>({});
  const [isMobile, setIsMobile] = useState(false);
  const [creating, setCreating] = useState(false);
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pendingApi = usePendingChanges((changes) => {
    setRows((prev) =>
      prev.map((row) => {
        const priceChange = changes.find((c) => c.id === row.id && c.field === "priceCents");
        const invChange = changes.find((c) => c.id === row.id && c.field === "inventoryN");
        if (!priceChange && !invChange) return row;
        const next = { ...row };
        if (priceChange) next.priceCents = Number(priceChange.value);
        if (invChange) {
          const n = Number(invChange.value);
          if (row.inventory.mode === "quantity") next.inventory = { ...row.inventory, quantity: n };
          else if (row.inventory.mode === "edition")
            next.inventory = { ...row.inventory, editionSize: n };
        }
        next.updatedAt = new Date();
        return next;
      }),
    );
    router.refresh();
  });

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (!initialOpenId) return;
    void loadProductForPanelAction(initialOpenId).then((product) => {
      if (product) setProductCache((prev) => ({ ...prev, [initialOpenId]: product }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const syncedOpenIdRef = useRef(initialOpenId);
  useEffect(() => {
    if (syncedOpenIdRef.current === openId) return;
    syncedOpenIdRef.current = openId;
    router.replace(openId ? `/admin/products?open=${openId}` : "/admin/products", {
      scroll: false,
    });
  }, [openId, router]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (liveOnly && row.status !== "published") return false;
      if (!q) return true;
      const title = productTitle(row.displayName1, row.displayName2).toLowerCase();
      return (
        row.name.toLowerCase().includes(q) ||
        row.slug.toLowerCase().includes(q) ||
        title.includes(q)
      );
    });
  }, [rows, liveOnly, search]);

  const liveCount = rows.filter((r) => r.status === "published").length;

  function openProduct(id: string) {
    if (openId === id) {
      collapsePanel();
      return;
    }
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
    setOpenId(id);
    setMountedId(id);
    if (!productCache[id]) {
      void loadProductForPanelAction(id).then((product) => {
        if (product) setProductCache((prev) => ({ ...prev, [id]: product }));
        else {
          pendingApi.showToast("Couldn't load that product.", { tone: "error" });
          collapsePanel();
        }
      });
    }
  }

  function collapsePanel() {
    setOpenId(null);
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
    collapseTimer.current = setTimeout(() => setMountedId(null), 260);
  }

  function moveRow(id: string, dir: -1 | 1) {
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.id === id);
      const newIdx = idx + dir;
      const item = prev[idx];
      if (idx === -1 || newIdx < 0 || newIdx >= prev.length || !item) return prev;
      const next = prev.slice();
      next.splice(idx, 1);
      next.splice(newIdx, 0, item);
      void reorderProductsAction(next.map((r) => r.id)).then(() =>
        pendingApi.showToast("Order saved"),
      );
      return next;
    });
  }

  /** Live/Draft/Archive from the panel's status chips. Returns whether the
   * change actually applied — a publish can be refused by the unnamed-draft
   * gate (`setStatus` in `@/lib/catalogAdmin`), and the chip's own optimism
   * has to unwind when it is. */
  async function handleStatusChange(
    id: string,
    status: "draft" | "published" | "archived",
  ): Promise<boolean> {
    const row = rows.find((r) => r.id === id);
    if (!row) return false;

    if (status === "archived") {
      return archive(row);
    }

    const prevStatus = row.status;
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    const result = await setProductStatusAction(id, status);
    if (!result.ok) {
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: prevStatus } : r)));
      pendingApi.showToast(result.error, { tone: "error" });
      return false;
    }
    pendingApi.showToast(status === "published" ? "Now live" : "Now hidden from the shop", {
      undo: () => {
        setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: prevStatus } : r)));
        void setProductStatusAction(id, prevStatus);
      },
    });
    router.refresh();
    return true;
  }

  async function archive(row: AdminProductListRow): Promise<boolean> {
    const result = await archiveProductAction(row.id);
    if (!result.ok) {
      pendingApi.showToast(result.error, { tone: "error" });
      return false;
    }
    setRows((prev) => prev.filter((r) => r.id !== row.id));
    setArchived((prev) => [...prev, { ...row, status: "archived" }]);
    if (openId === row.id) collapsePanel();
    pendingApi.showToast("Archived", {
      undo: () => {
        setArchived((prev) => prev.filter((r) => r.id !== row.id));
        setRows((prev) => [...prev, { ...row, status: "draft" }]);
        void restoreProductAction(row.id);
      },
    });
    router.refresh();
    return true;
  }

  async function restore(row: AdminProductListRow) {
    const result = await restoreProductAction(row.id);
    if (!result.ok) {
      pendingApi.showToast(result.error, { tone: "error" });
      return;
    }
    setArchived((prev) => prev.filter((r) => r.id !== row.id));
    setRows((prev) => [...prev, { ...row, status: "draft" }]);
    pendingApi.showToast("Restored");
    router.refresh();
  }

  async function duplicate(row: AdminProductListRow) {
    const result = await duplicateProductAction(row.id);
    if (!result.ok) {
      pendingApi.showToast(result.error, { tone: "error" });
      return;
    }
    const title = productTitle(row.displayName1, row.displayName2) || row.name;
    const newRow: AdminProductListRow = {
      id: result.id,
      slug: result.slug,
      name: `${row.name} copy`,
      displayName1: row.displayName1,
      displayName2: row.displayName2,
      status: "draft",
      priceCents: row.priceCents,
      position: rows.length,
      updatedAt: new Date(),
      thumbUrl: row.thumbUrl,
      inventory:
        row.inventory.mode === "edition"
          ? { ...row.inventory, sold: 0, reserved: 0, available: row.inventory.editionSize }
          : row.inventory.mode === "quantity"
            ? { mode: "quantity", quantity: 0 }
            : { mode: "untracked" },
    };
    setRows((prev) => [...prev, newRow]);
    pendingApi.showToast(`Duplicated "${title}"`);
    router.refresh();
  }

  function menuActionsFor(row: AdminProductListRow): RowMenuAction[] {
    const idx = rows.findIndex((r) => r.id === row.id);
    return [
      { key: "dup", label: "Duplicate", onClick: () => void duplicate(row) },
      { key: "open", label: "Open full editor", href: `/admin/products/${row.id}` },
      { key: "up", label: "Move up", disabled: idx <= 0, onClick: () => moveRow(row.id, -1) },
      {
        key: "down",
        label: "Move down",
        disabled: idx === -1 || idx >= rows.length - 1,
        onClick: () => moveRow(row.id, 1),
      },
    ];
  }

  async function createNew() {
    if (creating) return;
    setCreating(true);
    const { id, slug } = await createBlankProductAction();
    const newRow: AdminProductListRow = {
      id,
      slug,
      name: "",
      displayName1: "",
      displayName2: "",
      status: "draft",
      priceCents: 0,
      position: rows.length,
      updatedAt: new Date(),
      thumbUrl: null,
      inventory: { mode: "untracked" },
    };
    setRows((prev) => [...prev, newRow]);
    setCreating(false);
    openProduct(id);
  }

  const openProductData = mountedId ? productCache[mountedId] : undefined;
  const openRow = mountedId ? rows.find((r) => r.id === mountedId) : undefined;

  const panelNode =
    openProductData && openRow ? (
      <RackProductPanel
        product={openProductData}
        status={openRow.status}
        pendingApi={pendingApi}
        blobConfigured={blobConfigured}
        menuActions={menuActionsFor(openRow)}
        onStatusChange={(status) => handleStatusChange(openRow.id, status)}
      />
    ) : (
      <div className="rack-detail">
        <p className="rack-empty-note">Loading&hellip;</p>
      </div>
    );

  return (
    <>
      <div className="rack-page-header">
        <div>
          <h1 className="rack-page-title rack-bow">Products</h1>
        </div>
        <div className="rack-page-header-right">
          <span className="rack-page-count rack-mono" aria-live="polite">
            {rows.length} product{rows.length === 1 ? "" : "s"} &middot; {liveCount} live
          </span>
          <label className="adm-search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
              <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" />
            </svg>
            <span className="adm-sr-only">Search products</span>
            <input
              placeholder="Search products"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <button
            type="button"
            className={`adm-filter-chip${liveOnly ? " is-on" : ""}`}
            aria-pressed={liveOnly}
            onClick={() => setLiveOnly((v) => !v)}
          >
            Live only
          </button>
          <button
            type="button"
            className="rack-btn-primary"
            disabled={creating}
            onClick={() => void createNew()}
          >
            <svg aria-hidden="true" className="rack-icon" viewBox="0 0 16 16">
              <path d="M8 3v10M3 8h10" />
            </svg>
            New product
          </button>
        </div>
      </div>

      <div className="rack-content">
        <div className="rack-grid">
          {filteredRows.map((row) => (
            <ProductCard
              key={row.id}
              row={row}
              isOpen={openId === row.id}
              onOpen={() => openProduct(row.id)}
            />
          ))}
          <button
            type="button"
            className="rack-card-new"
            disabled={creating}
            onClick={() => void createNew()}
            aria-label="Add a new product"
          >
            <svg
              aria-hidden="true"
              className="rack-icon"
              style={{ width: 22, height: 22 }}
              viewBox="0 0 16 16"
            >
              <path d="M8 3v10M3 8h10" />
            </svg>
            <span>New product</span>
          </button>
        </div>

        {mountedId && !isMobile && panelNode}
      </div>

      {archived.length > 0 && (
        <details className="rack-archived">
          <summary>
            Archived ({archived.length})
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" />
            </svg>
          </summary>
          {archived.map((row) => (
            <div key={row.id} className="rack-archived-row">
              <span className="rack-name">
                {productTitle(row.displayName1, row.displayName2) || row.name || "No name yet"}
              </span>
              <span className="rack-mono">/{row.slug}</span>
              <button type="button" className="rack-btn" onClick={() => void restore(row)}>
                Restore
              </button>
            </div>
          ))}
        </details>
      )}

      {mountedId && isMobile && (
        <div className={`adm-mobile-sheet${openId === mountedId ? " is-open" : ""}`}>
          <div className="adm-mobile-sheet-header">
            <div className="adm-sheet-handle" aria-hidden="true" />
            <button type="button" className="adm-btn" onClick={collapsePanel}>
              Close
            </button>
          </div>
          <div className="adm-mobile-sheet-body">{panelNode}</div>
        </div>
      )}

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
