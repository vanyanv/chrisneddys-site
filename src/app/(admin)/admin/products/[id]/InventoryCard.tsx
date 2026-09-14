"use client";

import { useActionState, useState } from "react";
import type { AdminProduct } from "@/lib/catalogAdmin";
import { setInventoryAction, type InventoryActionState } from "../actions";

const initial: InventoryActionState = {};

type Mode = "untracked" | "quantity" | "edition";

export function InventoryCard({ product }: { product: AdminProduct }) {
  const [state, formAction, pending] = useActionState(setInventoryAction, initial);
  const [mode, setMode] = useState<Mode>(product.inventory.mode);

  const currentQuantity = product.inventory.mode === "quantity" ? product.inventory.quantity : 0;
  const currentEditionSize =
    product.inventory.mode === "edition" ? product.inventory.editionSize : 50;

  return (
    <div className="adm-card">
      <h2 className="adm-h2">Inventory</h2>

      <form action={formAction} className="adm-inventory-form">
        <input type="hidden" name="id" value={product.id} />

        <div className="adm-radio-group" role="radiogroup" aria-label="Inventory mode">
          <label className="adm-radio">
            <input
              type="radio"
              name="mode"
              value="untracked"
              checked={mode === "untracked"}
              onChange={() => setMode("untracked")}
            />
            Untracked
          </label>
          <label className="adm-radio">
            <input
              type="radio"
              name="mode"
              value="quantity"
              checked={mode === "quantity"}
              onChange={() => setMode("quantity")}
            />
            Track quantity
          </label>
          <label className="adm-radio">
            <input
              type="radio"
              name="mode"
              value="edition"
              checked={mode === "edition"}
              onChange={() => setMode("edition")}
            />
            Numbered edition
          </label>
        </div>

        {mode === "quantity" && (
          <div className="adm-field">
            <label htmlFor="inv-quantity" className="adm-label">
              Quantity
            </label>
            <input
              id="inv-quantity"
              name="n"
              type="number"
              min="0"
              step="1"
              className="adm-input"
              defaultValue={currentQuantity}
            />
          </div>
        )}

        {mode === "edition" && (
          <div className="adm-field">
            <label htmlFor="inv-edition-size" className="adm-label">
              Edition size
            </label>
            <input
              id="inv-edition-size"
              name="n"
              type="number"
              min="1"
              step="1"
              className="adm-input"
              defaultValue={currentEditionSize}
            />
          </div>
        )}

        <button type="submit" className="adm-btn adm-btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Save inventory"}
        </button>
        {state?.error && (
          <p className="adm-error" role="alert">
            {state.error}
          </p>
        )}
        {state?.ok && <p className="adm-notice">Saved.</p>}
      </form>

      {product.inventory.mode === "edition" && (
        <>
          <p className="adm-inv-summary">
            {product.inventory.available} available · {product.inventory.reserved} in a checkout ·{" "}
            {product.inventory.sold} sold
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
    </div>
  );
}
