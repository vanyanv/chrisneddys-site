"use client";

import { useEffect, useState } from "react";
import type { AdminProduct } from "@/lib/catalogAdmin";
import { imageThumbSrc } from "@/lib/productImage";
import { joinRequirements, missingPublishRequirements } from "@/lib/publishRequirements";
import { PhotosEditor } from "./PhotosEditor";
import { RackMoreDetails } from "./RackMoreDetails";
import { RunSection } from "./RackRunSection";
import { RowMenu, type RowMenuAction } from "./RowMenu";
import { productTitle, relativeTime } from "./format";
import { revertOnEscape } from "./revertOnEscape";
import type { UsePendingChanges } from "./usePendingChanges";

const STATUS_CHIPS: { key: "published" | "draft" | "archived"; label: string }[] = [
  { key: "published", label: "Live" },
  { key: "draft", label: "Draft" },
  { key: "archived", label: "Archive" },
];

/**
 * The Rack's detail panel (`Products.dc.html`) — header, photos, name/price/
 * limit, the run, and Live/Draft/Archive, with everything the old Sheet
 * editor could do that the artboard has no room for (eyebrow, description,
 * details, authenticity, slug/meta) folded into "More details" below. One
 * `pendingApi` (shared with the grid's cards) backs every field here, same
 * as the old `ProductEditor`.
 */
export function RackProductPanel({
  product: initialProduct,
  status,
  pendingApi,
  blobConfigured,
  menuActions,
  onStatusChange,
}: {
  product: AdminProduct;
  /**
   * The row's current status, from the grid's own list state — not
   * `product.status`. The grid is what a status chip, and a toast's Undo,
   * actually update; `product` is a full-detail snapshot fetched once when
   * the panel opens and otherwise never refreshed, so reading status off it
   * would go stale the moment an Undo (or a chip click on this very panel)
   * changed it out from under the cached copy.
   */
  status: "draft" | "published" | "archived";
  pendingApi: UsePendingChanges;
  blobConfigured: boolean;
  menuActions: RowMenuAction[];
  /** Returns whether the change actually applied — a publish can be refused
   * by the unnamed-draft gate in `setStatus` (see `@/lib/catalogAdmin`). */
  onStatusChange: (status: "draft" | "published" | "archived") => Promise<boolean>;
}) {
  const [product, setProduct] = useState(initialProduct);
  // Re-seed from the prop when the catalogue hands down a freshly loaded
  // copy after a save (issue #40). Without this the panel keeps whatever it
  // was given when it opened, so its heading and run summary went on showing
  // pre-save values while the footer said "Saved just now".
  //
  // This cannot clobber someone mid-edit: every field reads
  // `pendingApi.getValue(...) ?? product.X`, so an unsaved edit lives in the
  // pending store and still wins over anything re-seeded here.
  useEffect(() => setProduct(initialProduct), [initialProduct]);
  const [statusBusy, setStatusBusy] = useState(false);

  function patch(p: Partial<AdminProduct>) {
    setProduct((prev) => ({ ...prev, ...p }));
  }

  const dn1 = String(pendingApi.getValue(product.id, "displayName1") ?? product.displayName1);
  const dn2 = String(pendingApi.getValue(product.id, "displayName2") ?? product.displayName2);
  const title = productTitle(dn1, dn2);

  function commitDisplayName(field: "displayName1" | "displayName2", raw: string) {
    const original = product[field];
    if (raw === original) pendingApi.clearValue(product.id, field);
    else pendingApi.setValue(product.id, field, raw);
  }

  const pendingPrice = pendingApi.getValue(product.id, "priceCents");
  const priceCents = pendingPrice !== undefined ? Number(pendingPrice) : product.priceCents;

  function commitPrice(raw: string) {
    const dollars = Number(raw);
    if (!Number.isFinite(dollars) || dollars < 0) return;
    const cents = Math.round(dollars * 100);
    if (cents === product.priceCents) pendingApi.clearValue(product.id, "priceCents");
    else pendingApi.setValue(product.id, "priceCents", cents);
  }

  const perOrderLimit = Number(
    pendingApi.getValue(product.id, "perOrderLimit") ?? product.perOrderLimit,
  );

  function commitLimit(raw: string) {
    const n = Math.round(Number(raw));
    if (!Number.isInteger(n) || n < 1) return;
    if (n === product.perOrderLimit) pendingApi.clearValue(product.id, "perOrderLimit");
    else pendingApi.setValue(product.id, "perOrderLimit", n);
  }

  const inventoryN =
    pendingApi.getValue(product.id, "inventoryN") ??
    (product.inventory.mode === "quantity"
      ? product.inventory.quantity
      : product.inventory.mode === "edition"
        ? product.inventory.editionSize
        : 0);

  function commitInventoryN(raw: string) {
    const n = Number(raw);
    const current =
      product.inventory.mode === "edition"
        ? product.inventory.editionSize
        : product.inventory.mode === "quantity"
          ? product.inventory.quantity
          : 0;
    if (!Number.isFinite(n)) return;
    if (n === current) pendingApi.clearValue(product.id, "inventoryN");
    else pendingApi.setValue(product.id, "inventoryN", Math.round(n));
  }

  const onlineN = Number(
    pendingApi.getValue(product.id, "onlineN") ??
      (product.inventory.mode === "edition" ? product.inventory.available : 0),
  );

  function commitOnlineN(raw: string) {
    if (product.inventory.mode !== "edition") return;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return;
    if (n === product.inventory.available) pendingApi.clearValue(product.id, "onlineN");
    else pendingApi.setValue(product.id, "onlineN", Math.round(n));
  }

  async function changeStatus(next: "draft" | "published" | "archived") {
    if (next === status || statusBusy) return;
    setStatusBusy(true);
    await onStatusChange(next);
    setStatusBusy(false);
  }

  const cover = product.views[0] ? imageThumbSrc(product.photoDir, product.views[0]) : null;

  // What this draft is still missing before the Live chip will take —
  // computed from the on-screen (name/price) or last-committed (run mode,
  // photos — both save immediately, never through `pendingApi`) state, so
  // it reads the same thing `setStatus` will check the moment it's clicked,
  // not a half-typed guess. `changeStatus` still hits that real gate on
  // click regardless: this is a preview, so an owner can see what's
  // outstanding before reaching for the button, not a second copy of the
  // rule that could fall out of step with it.
  const publishGaps = missingPublishRequirements({
    hasName: dn1.trim() !== "",
    hasPrice: priceCents > 0,
    hasRunSize: product.inventory.mode !== "untracked",
    hasPhoto: product.views.length > 0,
  });

  const pendingForThis = Array.from(pendingApi.pending.values()).filter(
    (e) => e.id === product.id,
  ).length;
  let savingText: string;
  let isSaved = false;
  if (pendingForThis > 0) {
    savingText = `${pendingForThis} unsaved change${pendingForThis === 1 ? "" : "s"}`;
  } else if (pendingApi.lastSaved?.ids.includes(product.id)) {
    savingText = `Saved ${relativeTime(pendingApi.lastSaved.at)}`;
    isSaved = true;
  } else {
    savingText = "Saved";
    isSaved = true;
  }

  return (
    <div className="rack-detail" data-testid="product-panel">
      <div className="rack-detail-head">
        {cover ? (
          <img className="rack-detail-thumb" src={cover} alt="" width={40} height={40} />
        ) : (
          <span className="rack-detail-thumb-empty" aria-hidden="true" />
        )}
        <div className="rack-detail-heading">
          <h3 className={`rack-bow rack-detail-title${title ? "" : " is-empty"}`}>
            {title || "No name yet"}
          </h3>
          <div className="rack-detail-sub">
            <span className="rack-mono" style={{ fontSize: 11, color: "var(--rack-muted)" }}>
              /shop/{product.slug}
            </span>
            {status === "published" && (
              <a href={`/shop/${product.slug}/`} target="_blank" rel="noreferrer">
                View ↗
              </a>
            )}
          </div>
        </div>
        <RowMenu label={`Actions for ${title || "this product"}`} actions={menuActions} />
      </div>

      <PhotosEditor product={product} blobConfigured={blobConfigured} onProductPatch={patch} />

      <div className="rack-field-pair" key={`names-${pendingApi.resetToken}`}>
        <div className="adm-field">
          <label htmlFor={`p-n1-${product.id}`} className="adm-label">
            Name line 1
          </label>
          <input
            id={`p-n1-${product.id}`}
            className="adm-input rack-mono"
            defaultValue={dn1}
            onBlur={(e) => commitDisplayName("displayName1", e.target.value)}
          />
        </div>
        <div className="adm-field">
          <label htmlFor={`p-n2-${product.id}`} className="adm-label">
            Line 2
          </label>
          <input
            id={`p-n2-${product.id}`}
            className="adm-input rack-mono"
            defaultValue={dn2}
            onBlur={(e) => commitDisplayName("displayName2", e.target.value)}
          />
        </div>
      </div>

      <div className="rack-field-pair" key={`price-${pendingApi.resetToken}`}>
        <div className="adm-field">
          <label htmlFor={`p-pr-${product.id}`} className="adm-label">
            Price
          </label>
          <input
            id={`p-pr-${product.id}`}
            className="adm-input rack-mono"
            defaultValue={(priceCents / 100).toFixed(2)}
            inputMode="decimal"
            onBlur={(e) => commitPrice(e.target.value)}
            onKeyDown={(e) => revertOnEscape(e, (priceCents / 100).toFixed(2))}
          />
          {pendingApi.getError(product.id, "priceCents") && (
            <p className="adm-field-error" role="alert">
              {pendingApi.getError(product.id, "priceCents")}
            </p>
          )}
        </div>
        <div className="adm-field">
          <label htmlFor={`p-lim-${product.id}`} className="adm-label">
            Limit per order
          </label>
          <input
            id={`p-lim-${product.id}`}
            type="number"
            min={1}
            step={1}
            className="adm-input rack-mono"
            defaultValue={String(perOrderLimit)}
            onBlur={(e) => commitLimit(e.target.value)}
          />
        </div>
      </div>

      <RunSection
        key={`run-${pendingApi.resetToken}`}
        product={product}
        inventoryN={Number(inventoryN)}
        onCommitSize={commitInventoryN}
        onlineN={onlineN}
        onCommitOnline={commitOnlineN}
      />

      <div className="rack-hairline rack-status-row">
        <span className="rack-eyebrow">Status</span>
        <div className="rack-chips" role="group" aria-label="Status">
          {STATUS_CHIPS.map((chip) => (
            <button
              key={chip.key}
              type="button"
              className={`rack-chip${status === chip.key ? " is-active" : ""}`}
              aria-pressed={status === chip.key}
              disabled={statusBusy}
              onClick={() => void changeStatus(chip.key)}
            >
              {chip.label}
            </button>
          ))}
        </div>
        {status !== "published" && publishGaps.length > 0 && (
          <p className="rack-eyebrow rack-publish-checklist">
            Needs {joinRequirements(publishGaps)} before it can go live
          </p>
        )}
      </div>

      <RackMoreDetails product={product} pendingApi={pendingApi} onProductPatch={patch} />

      <span className={`adm-saving rack-hairline${isSaved ? " is-saved" : ""}`}>
        <span className="adm-saving-icon" aria-hidden="true" />
        {savingText}
      </span>
    </div>
  );
}
