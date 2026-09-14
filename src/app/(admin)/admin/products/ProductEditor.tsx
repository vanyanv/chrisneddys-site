"use client";

import { useState } from "react";
import type { AdminProduct, InventoryMode } from "@/lib/catalogAdmin";
import { setInventoryPlainAction } from "./actions";
import { PhotosEditor } from "./PhotosEditor";
import { RowMenu, type RowMenuAction } from "./RowMenu";
import { relativeTime } from "./format";
import type { UsePendingChanges } from "./usePendingChanges";

const MODES: { key: InventoryMode; label: string }[] = [
  { key: "untracked", label: "Untracked" },
  { key: "quantity", label: "Count" },
  { key: "edition", label: "Numbered edition" },
];

/** The shared three-group editor: Photos, Copy, Edition &amp; extras — used
 * both full width on `[id]/page.tsx` (`standalone`) and inside the sheet's
 * expanded row / mobile sheet. Every field here writes into the SAME
 * `pendingApi` pending map the sheet's Price/Stock cells use, so one Save
 * bar covers the whole page. The caller owns the outer accordion/sheet
 * chrome (`.adm-row-expand-grid` etc.) — this renders only the three
 * `<section>`s and the footer. */
export function ProductEditor({
  product: initialProduct,
  pendingApi,
  blobConfigured,
  menuActions,
}: {
  product: AdminProduct;
  pendingApi: UsePendingChanges;
  blobConfigured: boolean;
  menuActions: RowMenuAction[];
}) {
  const [product, setProduct] = useState(initialProduct);
  const [modeBusy, setModeBusy] = useState(false);

  function patch(p: Partial<AdminProduct>) {
    setProduct((prev) => ({ ...prev, ...p }));
  }

  function textValue(field: "displayName1" | "displayName2" | "eyebrow" | "description"): string {
    const pending = pendingApi.getValue(product.id, field);
    return pending !== undefined ? String(pending) : product[field];
  }

  function commitText(
    field: "displayName1" | "displayName2" | "eyebrow" | "description",
    raw: string,
  ) {
    const original = product[field];
    if (raw === original) pendingApi.clearValue(product.id, field);
    else pendingApi.setValue(product.id, field, raw);
  }

  function detailsValue(): string {
    const pending = pendingApi.getValue(product.id, "details");
    const list = pending !== undefined ? (pending as string[]) : product.details;
    return list.join("\n");
  }

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

  const inventoryN =
    pendingApi.getValue(product.id, "inventoryN") ??
    (product.inventory.mode === "quantity"
      ? product.inventory.quantity
      : product.inventory.mode === "edition"
        ? product.inventory.editionSize
        : 0);

  const perOrderLimit = Number(
    pendingApi.getValue(product.id, "perOrderLimit") ?? product.perOrderLimit,
  );

  const slugValue = String(pendingApi.getValue(product.id, "slug") ?? product.slug);
  const metaValue = String(
    pendingApi.getValue(product.id, "metaDescription") ?? product.metaDescription,
  );
  const authCopyValue = String(
    pendingApi.getValue(product.id, "authenticityCopy") ?? product.authenticityCopy ?? "",
  );
  const facts = (pendingApi.getValue(product.id, "authenticityFacts") ??
    product.authenticityFacts) as {
    label: string;
    value: string;
  }[];

  function commitFacts(index: number, field: "label" | "value", value: string) {
    const current = [0, 1, 2, 3].map((i) => {
      const fact = facts[i] ?? { label: "", value: "" };
      return i === index ? { ...fact, [field]: value } : fact;
    });
    const cleaned = current.filter((f) => f.label.trim() && f.value.trim());
    pendingApi.setValue(product.id, "authenticityFacts", cleaned);
  }

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
    <>
      <PhotosEditor product={product} blobConfigured={blobConfigured} onProductPatch={patch} />

      <section key={pendingApi.resetToken}>
        <h4 className="adm-group-label">Copy</h4>
        <div className="adm-field">
          <label htmlFor={`dn1-${product.id}`} className="adm-label">
            Display line 1
          </label>
          <input
            id={`dn1-${product.id}`}
            className="adm-input"
            defaultValue={textValue("displayName1")}
            onBlur={(e) => commitText("displayName1", e.target.value)}
          />
        </div>
        <div className="adm-field">
          <label htmlFor={`dn2-${product.id}`} className="adm-label">
            Display line 2
          </label>
          <input
            id={`dn2-${product.id}`}
            className="adm-input"
            defaultValue={textValue("displayName2")}
            onBlur={(e) => commitText("displayName2", e.target.value)}
          />
        </div>
        <div className="adm-field">
          <label htmlFor={`eyebrow-${product.id}`} className="adm-label">
            Eyebrow
          </label>
          <input
            id={`eyebrow-${product.id}`}
            className="adm-input"
            defaultValue={textValue("eyebrow")}
            onBlur={(e) => commitText("eyebrow", e.target.value)}
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
            defaultValue={textValue("description")}
            onBlur={(e) => commitText("description", e.target.value)}
          />
        </div>
        <div className="adm-field">
          <label htmlFor={`details-${product.id}`} className="adm-label">
            Details (one per line)
          </label>
          <textarea
            id={`details-${product.id}`}
            className="adm-textarea"
            rows={5}
            defaultValue={detailsValue()}
            onBlur={(e) => commitDetails(e.target.value)}
          />
        </div>
      </section>

      <section key={`extras-${pendingApi.resetToken}`}>
        <h4 className="adm-group-label">Edition &amp; extras</h4>
        <div className="adm-segmented" role="group" aria-label="Inventory mode">
          {MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              className={m.key === product.inventory.mode ? "is-active" : ""}
              aria-pressed={m.key === product.inventory.mode}
              disabled={modeBusy}
              onClick={() => changeMode(m.key)}
            >
              {m.label}
            </button>
          ))}
        </div>

        {product.inventory.mode !== "untracked" && (
          <div className="adm-field">
            <label htmlFor={`invn-${product.id}`} className="adm-label">
              {product.inventory.mode === "edition" ? "Edition size" : "Quantity"}
            </label>
            <input
              id={`invn-${product.id}`}
              type="number"
              min={product.inventory.mode === "edition" ? 1 : 0}
              step={1}
              className="adm-input"
              defaultValue={String(inventoryN)}
              onBlur={(e) => {
                const n = Number(e.target.value);
                const current =
                  product.inventory.mode === "edition"
                    ? product.inventory.editionSize
                    : product.inventory.mode === "quantity"
                      ? product.inventory.quantity
                      : 0;
                if (!Number.isFinite(n)) return;
                if (n === current) pendingApi.clearValue(product.id, "inventoryN");
                else pendingApi.setValue(product.id, "inventoryN", n);
              }}
            />
          </div>
        )}

        {product.inventory.mode === "edition" && (
          <>
            <p className="adm-inv-summary">
              {product.inventory.available} available &middot; {product.inventory.reserved} in a
              checkout &middot; {product.inventory.sold} sold
            </p>
            <div className="adm-edition-legend">
              <span className="adm-edition-key is-available">Available</span>
              <span className="adm-edition-key is-reserved">In a checkout</span>
              <span className="adm-edition-key is-sold">Sold</span>
            </div>
            <div className="adm-edition-grid">
              {product.editions.map((edition) => (
                <span
                  key={edition.number}
                  className={`adm-edition-cell is-${edition.status}`}
                  title={`#${edition.number} — ${edition.status}`}
                >
                  {edition.number}
                </span>
              ))}
            </div>
          </>
        )}

        <div className="adm-field">
          <span className="adm-label" id={`pol-label-${product.id}`}>
            Per-order limit
          </span>
          <div className="adm-stepper" role="group" aria-labelledby={`pol-label-${product.id}`}>
            <button
              type="button"
              aria-label="Decrease per-order limit"
              disabled={perOrderLimit <= 1}
              onClick={() => {
                const next = Math.max(1, perOrderLimit - 1);
                if (next === product.perOrderLimit)
                  pendingApi.clearValue(product.id, "perOrderLimit");
                else pendingApi.setValue(product.id, "perOrderLimit", next);
              }}
            >
              &ndash;
            </button>
            <span className="adm-stepper-value">{perOrderLimit}</span>
            <button
              type="button"
              aria-label="Increase per-order limit"
              onClick={() => {
                const next = perOrderLimit + 1;
                if (next === product.perOrderLimit)
                  pendingApi.clearValue(product.id, "perOrderLimit");
                else pendingApi.setValue(product.id, "perOrderLimit", next);
              }}
            >
              +
            </button>
          </div>
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
                  const raw = e.target.value;
                  if (raw === product.metaDescription)
                    pendingApi.clearValue(product.id, "metaDescription");
                  else pendingApi.setValue(product.id, "metaDescription", raw);
                }}
              />
              <p className="adm-help">{metaValue.length}/155</p>
            </div>
          </div>
        </details>
      </section>

      <div className="adm-editor-footer">
        <span className={`adm-saving${isSaved ? " is-saved" : ""}`}>
          <span className="adm-saving-icon" aria-hidden="true" />
          {savingText}
        </span>
        {product.status === "published" && (
          <a className="adm-btn" href={`/shop/${product.slug}/`} target="_blank" rel="noreferrer">
            View on site ↗
          </a>
        )}
        <RowMenu label={`Actions for ${product.name}`} actions={menuActions} />
      </div>
    </>
  );
}
