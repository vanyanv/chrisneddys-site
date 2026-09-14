"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminProduct, AdminProductListRow } from "@/lib/catalogAdmin";
import {
  archiveProductAction,
  createProductPlainAction,
  duplicateProductAction,
  loadProductForPanelAction,
  reorderProductsAction,
  restoreProductAction,
  setProductStatusAction,
  updateProductFieldAction,
} from "./actions";
import { ProductEditor } from "./ProductEditor";
import type { RowMenuAction } from "./RowMenu";
import { Toast } from "./Toast";
import { formatDollars, formatPrice, relativeTime } from "./format";
import { usePendingChanges } from "./usePendingChanges";
import { usePointerListReorder } from "./usePointerListReorder";

/** Price cell: rest state is a labelled button showing "$48.00"; a click
 * swaps it for a selected input. Enter/blur commits into the pending map
 * (`.is-changed`); Escape reverts without committing. */
function PriceCell({
  row,
  pendingApi,
}: {
  row: AdminProductListRow;
  pendingApi: ReturnType<typeof usePendingChanges>;
}) {
  const [editing, setEditing] = useState(false);
  const pendingValue = pendingApi.getValue(row.id, "priceCents");
  const cents = pendingValue !== undefined ? Number(pendingValue) : row.priceCents;
  const changed = pendingValue !== undefined;
  const error = pendingApi.getError(row.id, "priceCents");

  useEffect(() => {
    setEditing(false);
  }, [pendingApi.resetToken]);

  function commit(raw: string) {
    setEditing(false);
    const dollars = Number(raw);
    if (!Number.isFinite(dollars) || dollars < 0) return;
    const newCents = Math.round(dollars * 100);
    if (newCents === row.priceCents) pendingApi.clearValue(row.id, "priceCents");
    else pendingApi.setValue(row.id, "priceCents", newCents);
  }

  if (editing) {
    return (
      <div className="adm-cell-edit is-editing" data-field="price">
        <label className="adm-sr-only" htmlFor={`price-${row.id}`}>
          Price for {row.name}
        </label>
        <input
          id={`price-${row.id}`}
          className="adm-cell-input"
          defaultValue={formatDollars(cents)}
          autoFocus
          onFocus={(e) => e.target.select()}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") setEditing(false);
          }}
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      className={`adm-cell-edit${changed ? " is-changed" : ""}${error ? " is-error" : ""}`}
      data-field="price"
      onClick={() => setEditing(true)}
    >
      <span className="adm-sr-only">Price for {row.name}</span>
      {formatPrice(cents)}
      {error && <span className="adm-cell-error">{error}</span>}
    </button>
  );
}

/** Stock cell: quantity/edition modes are click-to-edit like Price
 * (`inventoryN`); untracked shows a plain em dash. */
function StockCell({
  row,
  pendingApi,
}: {
  row: AdminProductListRow;
  pendingApi: ReturnType<typeof usePendingChanges>;
}) {
  const [editing, setEditing] = useState(false);
  const inputId = `stock-${row.id}`;

  useEffect(() => {
    setEditing(false);
  }, [pendingApi.resetToken]);

  if (row.inventory.mode === "untracked") {
    return (
      <div className="adm-stock-wrap">
        <span className="adm-stock adm-inv-untracked">&mdash;</span>
      </div>
    );
  }

  const pendingValue = pendingApi.getValue(row.id, "inventoryN");
  const current =
    row.inventory.mode === "quantity" ? row.inventory.quantity : row.inventory.editionSize;
  const n = pendingValue !== undefined ? Number(pendingValue) : current;
  const changed = pendingValue !== undefined;
  const error = pendingApi.getError(row.id, "inventoryN");

  function commit(raw: string) {
    setEditing(false);
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    const value = Math.round(parsed);
    if (value === current) pendingApi.clearValue(row.id, "inventoryN");
    else pendingApi.setValue(row.id, "inventoryN", value);
  }

  if (editing) {
    return (
      <div className="adm-stock-wrap">
        <div className="adm-cell-edit is-editing" data-field="stock">
          <label className="adm-sr-only" htmlFor={inputId}>
            Stock for {row.name}
          </label>
          <input
            id={inputId}
            className="adm-cell-input"
            defaultValue={String(n)}
            autoFocus
            onFocus={(e) => e.target.select()}
            onBlur={(e) => commit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") setEditing(false);
            }}
          />
        </div>
      </div>
    );
  }

  if (row.inventory.mode === "quantity") {
    if (n === 0) {
      return (
        <div className="adm-stock-wrap">
          <span className="adm-stock is-out">
            0 &middot; Sold out
            <button
              type="button"
              className="adm-restock"
              onClick={() => {
                setEditing(true);
              }}
            >
              Restock
            </button>
          </span>
        </div>
      );
    }
    return (
      <div className="adm-stock-wrap">
        <button
          type="button"
          className={`adm-cell-edit${changed ? " is-changed" : ""}${error ? " is-error" : ""}`}
          data-field="stock"
          onClick={() => setEditing(true)}
        >
          <span className="adm-sr-only">Stock for {row.name}</span>
          <span className={`adm-stock${n <= 3 ? " is-low" : ""}`}>{n}</span>
          {error && <span className="adm-cell-error">{error}</span>}
        </button>
      </div>
    );
  }

  // edition
  const available = row.inventory.available;
  const ratio = n > 0 ? available / n : 0;
  return (
    <div className="adm-stock-wrap">
      <button
        type="button"
        className={`adm-cell-edit${changed ? " is-changed" : ""}${error ? " is-error" : ""}`}
        data-field="stock"
        onClick={() => setEditing(true)}
      >
        <span className="adm-sr-only">Edition size for {row.name}</span>
        <span
          className={`adm-stock${available === 0 ? " is-out" : available <= 3 ? " is-low" : ""}`}
        >
          {available === 0 ? "Sold out" : `${available} / ${n}`}
        </span>
        <div className="adm-inv-bar" aria-hidden="true">
          <span style={{ width: `${Math.max(0, Math.min(100, ratio * 100))}%` }} />
        </div>
        {error && <span className="adm-cell-error">{error}</span>}
      </button>
    </div>
  );
}

export function ProductSheet({
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
  const [isAddingRow, setIsAddingRow] = useState(false);
  const [addName, setAddName] = useState("");
  const [addPrice, setAddPrice] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const addNameRef = useRef<HTMLInputElement>(null);
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
    const mq = window.matchMedia("(max-width: 719px)");
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

  const rowDrag = usePointerListReorder(
    rows.map((r) => r.id),
    (orderedIds) => {
      const byId = new Map(rows.map((r) => [r.id, r]));
      setRows(
        orderedIds.map((id) => byId.get(id)).filter((r): r is AdminProductListRow => Boolean(r)),
      );
      void reorderProductsAction(orderedIds).then(() => pendingApi.showToast("Order saved"));
    },
  );

  const orderedRows = useMemo(() => {
    const byId = new Map(rows.map((r) => [r.id, r]));
    return rowDrag.order
      .map((id) => byId.get(id))
      .filter((r): r is AdminProductListRow => Boolean(r));
  }, [rowDrag.order, rows]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orderedRows.filter((row) => {
      if (liveOnly && row.status !== "published") return false;
      if (q && !row.name.toLowerCase().includes(q) && !row.slug.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [orderedRows, liveOnly, search]);

  const liveCount = rows.filter((r) => r.status === "published").length;

  function expandRow(id: string) {
    if (openId === id) {
      collapseRow();
      return;
    }
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
    setOpenId(id);
    setMountedId(id);
    router.replace(`/admin/products?open=${id}`, { scroll: false });
    if (!productCache[id]) {
      void loadProductForPanelAction(id).then((product) => {
        if (product) setProductCache((prev) => ({ ...prev, [id]: product }));
        else {
          pendingApi.showToast("Couldn't load that product.", { tone: "error" });
          collapseRow();
        }
      });
    }
  }

  function collapseRow() {
    setOpenId(null);
    router.replace("/admin/products", { scroll: false });
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

  function toggleLive(row: AdminProductListRow) {
    const prevStatus = row.status;
    const nextStatus = prevStatus === "published" ? "draft" : "published";
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, status: nextStatus } : r)));
    void setProductStatusAction(row.id, nextStatus).then((result) => {
      if (!result.ok) {
        setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, status: prevStatus } : r)));
        pendingApi.showToast(result.error, { tone: "error" });
        return;
      }
      pendingApi.showToast(nextStatus === "published" ? "Now live" : "Now hidden from the shop", {
        undo: () => {
          setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, status: prevStatus } : r)));
          void setProductStatusAction(row.id, prevStatus);
        },
      });
    });
  }

  async function duplicate(row: AdminProductListRow) {
    const result = await duplicateProductAction(row.id);
    if (!result.ok) {
      pendingApi.showToast(result.error, { tone: "error" });
      return;
    }
    const copyName = `${row.name} copy`;
    const newRow: AdminProductListRow = {
      id: result.id,
      slug: result.slug,
      name: copyName,
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
    pendingApi.showToast(`Duplicated as "${copyName}"`);
    router.refresh();
  }

  async function archive(row: AdminProductListRow) {
    const result = await archiveProductAction(row.id);
    if (!result.ok) {
      pendingApi.showToast(result.error, { tone: "error" });
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== row.id));
    setArchived((prev) => [...prev, { ...row, status: "archived" }]);
    if (openId === row.id) collapseRow();
    pendingApi.showToast("Archived", {
      undo: () => {
        setArchived((prev) => prev.filter((r) => r.id !== row.id));
        setRows((prev) => [...prev, { ...row, status: "draft" }]);
        void restoreProductAction(row.id);
      },
    });
    router.refresh();
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
      { key: "archive", label: "Archive", onClick: () => void archive(row) },
    ];
  }

  function startAdd() {
    setIsAddingRow(true);
    requestAnimationFrame(() => addNameRef.current?.focus());
  }

  async function submitAdd() {
    const name = addName.trim();
    if (!name) {
      addNameRef.current?.focus();
      return;
    }
    setAddBusy(true);
    const result = await createProductPlainAction(name);
    if (!result.ok) {
      setAddBusy(false);
      pendingApi.showToast(result.error, { tone: "error" });
      return;
    }
    const dollars = Number(addPrice || "0");
    const priceCents = Number.isFinite(dollars) && dollars > 0 ? Math.round(dollars * 100) : 0;
    if (priceCents > 0) {
      await updateProductFieldAction(result.id, "priceCents", priceCents);
    }
    const newRow: AdminProductListRow = {
      id: result.id,
      slug: result.slug,
      name,
      status: "draft",
      priceCents,
      position: rows.length,
      updatedAt: new Date(),
      thumbUrl: null,
      inventory: { mode: "untracked" },
    };
    setRows((prev) => [...prev, newRow]);
    setIsAddingRow(false);
    setAddName("");
    setAddPrice("");
    setAddBusy(false);
    expandRow(result.id);
  }

  const openProduct = mountedId ? productCache[mountedId] : undefined;
  const openRow = mountedId ? rows.find((r) => r.id === mountedId) : undefined;

  const editorNode =
    openProduct && openRow ? (
      <ProductEditor
        product={openProduct}
        pendingApi={pendingApi}
        blobConfigured={blobConfigured}
        menuActions={menuActionsFor(openRow)}
      />
    ) : (
      <p className="adm-empty">Loading&hellip;</p>
    );

  return (
    <>
      <div className="adm-products-head">
        <h1 className="adm-h1">Products</h1>
        <span className="adm-label" aria-live="polite">
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
        <button type="button" className="adm-btn adm-btn-primary" onClick={startAdd}>
          + New product
        </button>
      </div>

      <div className="adm-sheet-cols" role="presentation">
        <span aria-hidden="true" />
        <span aria-hidden="true" />
        <span>Product</span>
        <span>Price</span>
        <span>Stock</span>
        <span>Live</span>
        <span>Updated</span>
        <span aria-hidden="true" />
      </div>

      {filteredRows.length === 0 && !isAddingRow && (
        <p className="adm-empty">
          {rows.length === 0 ? "No products yet." : "No products match your filters."}
        </p>
      )}

      {filteredRows.map((row) => {
        const isOpen = openId === row.id;
        const isDragging = rowDrag.draggingId === row.id;
        return (
          <div key={row.id}>
            <div
              className={`adm-sheet-row${isOpen ? " is-expanded" : ""}${isDragging ? " is-dragging" : ""}`}
              data-id={row.id}
              ref={rowDrag.registerRef(row.id)}
            >
              <button
                type="button"
                className="adm-drag-handle"
                aria-label={`Reorder ${row.name}`}
                onPointerDown={rowDrag.onPointerDownHandle(row.id)}
                onPointerMove={rowDrag.onPointerMoveHandle}
                onPointerUp={rowDrag.onPointerUpHandle}
              >
                ⣿
              </button>
              {row.thumbUrl ? (
                <img className="adm-thumb" src={row.thumbUrl} alt="" width={40} height={40} />
              ) : (
                <span className="adm-thumb adm-thumb-empty" aria-hidden="true" />
              )}
              <button type="button" className="adm-name-cell" onClick={() => expandRow(row.id)}>
                <span className="adm-name-cell-name">{row.name}</span>
                <span className="adm-name-cell-slug">/{row.slug}</span>
              </button>
              <PriceCell row={row} pendingApi={pendingApi} />
              <StockCell row={row} pendingApi={pendingApi} />
              <button
                type="button"
                className={`adm-pill${row.status === "published" ? " is-live" : " is-hidden"}`}
                aria-pressed={row.status === "published"}
                onClick={() => toggleLive(row)}
              >
                {row.status === "published" ? "Live" : "Hidden"}
              </button>
              <span className="adm-updated">{relativeTime(row.updatedAt)}</span>
              <button
                type="button"
                className="adm-chevron-btn"
                aria-label={isOpen ? `Collapse ${row.name}` : `Expand ${row.name}`}
                aria-expanded={isOpen}
                onClick={() => expandRow(row.id)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" />
                </svg>
              </button>
            </div>

            {mountedId === row.id && !isMobile && (
              <div className={`adm-row-expand${isOpen ? " is-open" : ""}`}>
                <div className="adm-row-expand-grid">{editorNode}</div>
              </div>
            )}
          </div>
        );
      })}

      {isAddingRow ? (
        <div className="adm-sheet-row" data-adding>
          <span aria-hidden="true" />
          <span className="adm-thumb adm-thumb-empty" aria-hidden="true" />
          <div className="adm-name-cell">
            <label className="adm-sr-only" htmlFor="add-row-name">
              New product name
            </label>
            <input
              id="add-row-name"
              ref={addNameRef}
              className="adm-input"
              placeholder="Product name"
              value={addName}
              disabled={addBusy}
              onChange={(e) => setAddName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submitAdd();
                if (e.key === "Escape") setIsAddingRow(false);
              }}
            />
          </div>
          <div className="adm-field">
            <label className="adm-sr-only" htmlFor="add-row-price">
              Price
            </label>
            <input
              id="add-row-price"
              className="adm-input"
              placeholder="0.00"
              inputMode="decimal"
              value={addPrice}
              disabled={addBusy}
              onChange={(e) => setAddPrice(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submitAdd();
                if (e.key === "Escape") setIsAddingRow(false);
              }}
            />
          </div>
          <button
            type="button"
            className="adm-btn adm-btn-primary"
            disabled={addBusy}
            onClick={submitAdd}
          >
            {addBusy ? "Adding…" : "Add"}
          </button>
          <button
            type="button"
            className="adm-btn"
            disabled={addBusy}
            onClick={() => setIsAddingRow(false)}
          >
            Cancel
          </button>
        </div>
      ) : (
        <button type="button" className="adm-add-row" onClick={startAdd}>
          + Add a product
        </button>
      )}

      {archived.length > 0 && (
        <details className="adm-accordion">
          <summary>
            Archived ({archived.length})
            <svg
              className="adm-accordion-chevron"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" />
            </svg>
          </summary>
          <div className="adm-accordion-body">
            {archived.map((row) => (
              <div key={row.id} className="adm-photo-row">
                <span className="adm-name-cell-name">{row.name}</span>
                <span className="adm-name-cell-slug">/{row.slug}</span>
                <button type="button" className="adm-btn" onClick={() => void restore(row)}>
                  Restore
                </button>
              </div>
            ))}
          </div>
        </details>
      )}

      {mountedId && isMobile && (
        <div className={`adm-mobile-sheet${openId === mountedId ? " is-open" : ""}`}>
          <div className="adm-sheet-handle" aria-hidden="true" />
          <button type="button" className="adm-btn" onClick={collapseRow}>
            Close
          </button>
          <div className="adm-row-expand-grid">{editorNode}</div>
        </div>
      )}

      <button type="button" className="adm-fab" aria-label="New product" onClick={startAdd}>
        +
      </button>

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
