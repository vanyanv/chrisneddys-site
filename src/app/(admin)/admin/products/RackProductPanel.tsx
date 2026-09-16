"use client";

import { useState } from "react";
import type { AdminProduct, InventoryMode } from "@/lib/catalogAdmin";
import { imageThumbSrc } from "@/lib/productImage";
import { setInventoryPlainAction } from "./actions";
import { PhotosEditor } from "./PhotosEditor";
import { RowMenu, type RowMenuAction } from "./RowMenu";
import { productTitle, relativeTime } from "./format";
import type { UsePendingChanges } from "./usePendingChanges";

const STATUS_CHIPS: { key: "published" | "draft" | "archived"; label: string }[] = [
  { key: "published", label: "Live" },
  { key: "draft", label: "Draft" },
  { key: "archived", label: "Archive" },
];

const MODES: { key: InventoryMode; label: string }[] = [
  { key: "untracked", label: "Untracked" },
  { key: "quantity", label: "Count" },
  { key: "edition", label: "Numbered edition" },
];

/**
 * Escape reverts a field to its last-committed value without saving —
 * the plain always-editable fields the rack's fields use have no separate
 * "editing mode" to escape out of the way the old Sheet's click-to-edit
 * cells did, so this restores the same one-key undo-in-progress-edit by
 * resetting the input's value and blurring, which lets the ordinary
 * onBlur commit see the unchanged value and clear (or no-op) the pending
 * edit exactly like typing the original value back in and tabbing away.
 */
function revertOnEscape(e: React.KeyboardEvent<HTMLInputElement>, committedValue: string): void {
  if (e.key !== "Escape") return;
  e.currentTarget.value = committedValue;
  e.currentTarget.blur();
}

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
  const [modeBusy, setModeBusy] = useState(false);
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

  async function changeMode(next: InventoryMode) {
    if (next === product.inventory.mode) return;
    if (product.inventory.mode === "edition" && product.inventory.sold > 0 && next !== "edition") {
      const ok = window.confirm(
        `This edition has ${product.inventory.sold} sold number${product.inventory.sold === 1 ? "" : "s"}. Switching away loses that numbering. Continue?`,
      );
      if (!ok) return;
    }
    setModeBusy(true);
    const n = next === "quantity" ? 0 : next === "edition" ? 50 : undefined;
    const result = await setInventoryPlainAction(product.id, next, n);
    setModeBusy(false);
    if (!result.ok) {
      pendingApi.showToast(result.error, { tone: "error" });
      return;
    }
    pendingApi.clearValue(product.id, "inventoryN");
    patch({
      inventory:
        next === "untracked"
          ? { mode: "untracked" }
          : next === "quantity"
            ? { mode: "quantity", quantity: 0 }
            : { mode: "edition", editionSize: 50, sold: 0, reserved: 0, available: 50 },
      editions:
        next === "edition"
          ? Array.from({ length: 50 }, (_, i) => ({ number: i + 1, status: "available" as const }))
          : [],
    });
  }

  async function changeStatus(next: "draft" | "published" | "archived") {
    if (next === status || statusBusy) return;
    setStatusBusy(true);
    await onStatusChange(next);
    setStatusBusy(false);
  }

  const facts = (pendingApi.getValue(product.id, "authenticityFacts") ??
    product.authenticityFacts) as { label: string; value: string }[];

  function commitFacts(index: number, field: "label" | "value", value: string) {
    const current = [0, 1, 2, 3].map((i) => {
      const fact = facts[i] ?? { label: "", value: "" };
      return i === index ? { ...fact, [field]: value } : fact;
    });
    const cleaned = current.filter((f) => f.label.trim() && f.value.trim());
    pendingApi.setValue(product.id, "authenticityFacts", cleaned);
  }

  const slugValue = String(pendingApi.getValue(product.id, "slug") ?? product.slug);
  const metaValue = String(
    pendingApi.getValue(product.id, "metaDescription") ?? product.metaDescription,
  );
  const authCopyValue = String(
    pendingApi.getValue(product.id, "authenticityCopy") ?? product.authenticityCopy ?? "",
  );
  const eyebrowValue = String(pendingApi.getValue(product.id, "eyebrow") ?? product.eyebrow);
  const descriptionValue = String(
    pendingApi.getValue(product.id, "description") ?? product.description,
  );
  const detailsValue = (
    (pendingApi.getValue(product.id, "details") as string[] | undefined) ?? product.details
  ).join("\n");

  function commitDetails(raw: string) {
    const next = raw
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const original = product.details;
    const same = next.length === original.length && next.every((line, i) => line === original[i]);
    if (same) pendingApi.clearValue(product.id, "details");
    else pendingApi.setValue(product.id, "details", next);
  }

  const cover = product.views[0] ? imageThumbSrc(product.photoDir, product.views[0]) : null;

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
      </div>

      <details className="adm-accordion rack-hairline">
        <summary>
          More details
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
        <div className="adm-accordion-body" key={`more-${pendingApi.resetToken}`}>
          <div className="adm-field">
            <label htmlFor={`eyebrow-${product.id}`} className="adm-label">
              Eyebrow
            </label>
            <input
              id={`eyebrow-${product.id}`}
              className="adm-input"
              defaultValue={eyebrowValue}
              onBlur={(e) => {
                if (e.target.value === product.eyebrow)
                  pendingApi.clearValue(product.id, "eyebrow");
                else pendingApi.setValue(product.id, "eyebrow", e.target.value);
              }}
            />
          </div>
          <div className="adm-field">
            <label htmlFor={`desc-${product.id}`} className="adm-label">
              Description
            </label>
            <textarea
              id={`desc-${product.id}`}
              className="adm-textarea"
              rows={4}
              defaultValue={descriptionValue}
              onBlur={(e) => {
                if (e.target.value === product.description)
                  pendingApi.clearValue(product.id, "description");
                else pendingApi.setValue(product.id, "description", e.target.value);
              }}
            />
          </div>
          <div className="adm-field">
            <label htmlFor={`details-${product.id}`} className="adm-label">
              Details (one per line)
            </label>
            <textarea
              id={`details-${product.id}`}
              className="adm-textarea"
              rows={4}
              defaultValue={detailsValue}
              onBlur={(e) => commitDetails(e.target.value)}
            />
          </div>

          <span className="adm-label">Inventory mode</span>
          <div className="adm-segmented" role="group" aria-label="Inventory mode">
            {MODES.map((m) => (
              <button
                key={m.key}
                type="button"
                className={m.key === product.inventory.mode ? "is-active" : ""}
                aria-pressed={m.key === product.inventory.mode}
                disabled={modeBusy}
                onClick={() => void changeMode(m.key)}
              >
                {m.label}
              </button>
            ))}
          </div>

          <details className="adm-accordion">
            <summary>
              Authenticity
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
            <div className="adm-accordion-body" key={`auth-${pendingApi.resetToken}`}>
              <div className="adm-field">
                <label htmlFor={`authcopy-${product.id}`} className="adm-label">
                  Authenticity copy
                </label>
                <textarea
                  id={`authcopy-${product.id}`}
                  className="adm-textarea"
                  rows={3}
                  defaultValue={authCopyValue}
                  onBlur={(e) => {
                    const raw = e.target.value.trim();
                    const original = product.authenticityCopy ?? "";
                    if (raw === original) pendingApi.clearValue(product.id, "authenticityCopy");
                    else pendingApi.setValue(product.id, "authenticityCopy", raw || null);
                  }}
                />
              </div>
              <div className="adm-fact-grid">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="adm-fact-pair">
                    <label htmlFor={`fact-label-${product.id}-${i}`} className="adm-label">
                      Fact {i + 1} label
                    </label>
                    <input
                      id={`fact-label-${product.id}-${i}`}
                      className="adm-input"
                      defaultValue={facts[i]?.label ?? ""}
                      onBlur={(e) => commitFacts(i, "label", e.target.value)}
                    />
                    <label htmlFor={`fact-value-${product.id}-${i}`} className="adm-label">
                      Fact {i + 1} value
                    </label>
                    <input
                      id={`fact-value-${product.id}-${i}`}
                      className="adm-input"
                      defaultValue={facts[i]?.value ?? ""}
                      onBlur={(e) => commitFacts(i, "value", e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>
          </details>

          <details className="adm-accordion">
            <summary>
              Search engines
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
            <div className="adm-accordion-body" key={`seo-${pendingApi.resetToken}`}>
              <div className="adm-field">
                <label htmlFor={`slug-${product.id}`} className="adm-label">
                  Slug
                </label>
                <input
                  id={`slug-${product.id}`}
                  className="adm-input"
                  defaultValue={slugValue}
                  pattern="^[a-z0-9\-]+$"
                  onBlur={(e) => {
                    const raw = e.target.value.trim().toLowerCase();
                    if (raw === product.slug) pendingApi.clearValue(product.id, "slug");
                    else pendingApi.setValue(product.id, "slug", raw);
                  }}
                />
                <p className="adm-help">Lowercase letters, numbers and hyphens only.</p>
                {pendingApi.getError(product.id, "slug") && (
                  <p className="adm-error" role="alert">
                    {pendingApi.getError(product.id, "slug")}
                  </p>
                )}
              </div>
              <div className="adm-field">
                <label htmlFor={`meta-${product.id}`} className="adm-label">
                  Meta description
                </label>
                <textarea
                  id={`meta-${product.id}`}
                  className="adm-textarea"
                  rows={2}
                  maxLength={155}
                  defaultValue={metaValue}
                  onBlur={(e) => {
                    if (e.target.value === product.metaDescription)
                      pendingApi.clearValue(product.id, "metaDescription");
                    else pendingApi.setValue(product.id, "metaDescription", e.target.value);
                  }}
                />
                <p className="adm-help">{metaValue.length}/155</p>
              </div>
            </div>
          </details>
        </div>
      </details>

      <span className={`adm-saving rack-hairline${isSaved ? " is-saved" : ""}`}>
        <span className="adm-saving-icon" aria-hidden="true" />
        {savingText}
      </span>
    </div>
  );
}

/** "The run" — locked once the first number sells (issue #36's `n-run`
 * annotation: "the count locks the moment number one sells"). Contextual to
 * whichever inventory mode the product is currently in. */
function RunSection({
  product,
  inventoryN,
  onCommitSize,
}: {
  product: AdminProduct;
  inventoryN: number;
  onCommitSize: (raw: string) => void;
}) {
  if (product.inventory.mode === "untracked") {
    return (
      <div className="rack-hairline">
        <span className="rack-eyebrow">The run</span>
        <p className="rack-run-copy">
          Not tracked yet. Turn on Count or Numbered edition under &ldquo;More details&rdquo; to
          give it a run size.
        </p>
      </div>
    );
  }

  if (product.inventory.mode === "quantity") {
    return (
      <div className="rack-hairline">
        <div className="rack-run-head">
          <span className="rack-eyebrow">The run &mdash; {inventoryN} in stock</span>
        </div>
        <div className="adm-field" style={{ marginTop: 8 }}>
          <label htmlFor={`run-qty-${product.id}`} className="adm-sr-only">
            Quantity in stock
          </label>
          <input
            id={`run-qty-${product.id}`}
            type="number"
            min={0}
            step={1}
            className="adm-input rack-mono"
            defaultValue={String(inventoryN)}
            onBlur={(e) => onCommitSize(e.target.value)}
            onKeyDown={(e) => revertOnEscape(e, String(inventoryN))}
          />
        </div>
      </div>
    );
  }

  // edition — the size stays editable regardless of sales (the data layer,
  // `setInventory` in `@/lib/catalogAdmin`, is what actually refuses to
  // shrink it below the highest sold number; "the count locks at the first
  // sale" is a decision for phase 3's "Starting a run" screens, not this
  // one, so this panel doesn't invent that restriction early).
  const { sold, reserved, available } = product.inventory;

  return (
    <div className="rack-hairline">
      <div className="rack-run-head">
        <span className="rack-eyebrow">The run &mdash; {inventoryN} made</span>
      </div>
      <p className="rack-run-copy">
        {sold} sold, {reserved} held in open checkouts, {available} still going.
      </p>
      <div className="adm-field" style={{ marginTop: 8 }}>
        <label htmlFor={`run-size-${product.id}`} className="adm-label">
          Edition size
        </label>
        <input
          id={`run-size-${product.id}`}
          type="number"
          min={1}
          step={1}
          className="adm-input rack-mono"
          defaultValue={String(inventoryN)}
          onBlur={(e) => onCommitSize(e.target.value)}
          onKeyDown={(e) => revertOnEscape(e, String(inventoryN))}
        />
      </div>
      <div className="rack-edgrid" style={{ marginTop: 8 }}>
        {product.editions.map((edition) => (
          <span
            key={edition.number}
            className={`rack-edcell ${
              edition.status === "sold"
                ? "is-sold"
                : edition.status === "reserved"
                  ? "is-reserved"
                  : ""
            }`}
            title={`#${edition.number} — ${edition.status}`}
          />
        ))}
      </div>
      <div className="rack-edlegend">
        <span>
          <i className="is-available"></i>
          {available} going
        </span>
        <span>
          <i className="is-reserved"></i>
          {reserved} held
        </span>
        <span>
          <i className="is-sold"></i>
          {sold} sold
        </span>
      </div>
    </div>
  );
}
