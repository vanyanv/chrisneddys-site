"use client";

import { useActionState, useMemo, useState } from "react";
import type { AdminProduct } from "@/lib/catalogAdmin";
import {
  saveProductAction,
  setStatusAction,
  type SaveProductState,
  type StatusActionState,
} from "../actions";

const saveInitial: SaveProductState = {};
const statusInitial: StatusActionState = {};

function AuthFactFields({ product }: { product: AdminProduct }) {
  const facts = product.authenticityFacts;
  return (
    <div className="adm-fact-grid">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="adm-fact-pair">
          <label htmlFor={`authFactLabel${i}`} className="adm-label">
            Fact {i + 1} label
          </label>
          <input
            id={`authFactLabel${i}`}
            name={`authFactLabel${i}`}
            type="text"
            className="adm-input"
            defaultValue={facts[i]?.label ?? ""}
          />
          <label htmlFor={`authFactValue${i}`} className="adm-label">
            Fact {i + 1} value
          </label>
          <input
            id={`authFactValue${i}`}
            name={`authFactValue${i}`}
            type="text"
            className="adm-input"
            defaultValue={facts[i]?.value ?? ""}
          />
        </div>
      ))}
    </div>
  );
}

export function ProductForm({ product }: { product: AdminProduct }) {
  const [saveState, saveFormAction, savePending] = useActionState(saveProductAction, saveInitial);
  const [statusState, statusFormAction, statusPending] = useActionState(
    setStatusAction,
    statusInitial,
  );
  const [archiveArmed, setArchiveArmed] = useState(false);
  const [metaLength, setMetaLength] = useState(product.metaDescription.length);

  const currentStatus = useMemo(() => product.status, [product.status]);
  const nextToggleStatus = currentStatus === "published" ? "draft" : "published";

  return (
    <>
      <form id="product-form" action={saveFormAction} className="adm-card adm-product-form">
        <input type="hidden" name="id" value={product.id} />

        <h2 className="adm-h2">Product</h2>

        <div className="adm-field">
          <label htmlFor="name" className="adm-label">
            Title
          </label>
          <input
            id="name"
            name="name"
            type="text"
            className="adm-input"
            defaultValue={product.name}
            required
          />
        </div>

        <div className="adm-grid-2">
          <div className="adm-field">
            <label htmlFor="displayName1" className="adm-label">
              Display line 1
            </label>
            <input
              id="displayName1"
              name="displayName1"
              type="text"
              className="adm-input"
              defaultValue={product.displayName1}
            />
          </div>
          <div className="adm-field">
            <label htmlFor="displayName2" className="adm-label">
              Display line 2
            </label>
            <input
              id="displayName2"
              name="displayName2"
              type="text"
              className="adm-input"
              defaultValue={product.displayName2}
            />
          </div>
        </div>

        <div className="adm-field">
          <label htmlFor="eyebrow" className="adm-label">
            Eyebrow
          </label>
          <input
            id="eyebrow"
            name="eyebrow"
            type="text"
            className="adm-input"
            defaultValue={product.eyebrow}
          />
        </div>

        <div className="adm-field">
          <label htmlFor="slug" className="adm-label">
            Slug
          </label>
          {/* The hyphen in `pattern` is escaped because browsers compile that
              attribute with the `v` flag, where a bare `-` at the end of a
              character class is a syntax error. The invalid regex threw and the
              attribute was dropped, so the field accepted any slug at all. */}
          <input
            id="slug"
            name="slug"
            type="text"
            className="adm-input"
            pattern="^[a-z0-9\-]+$"
            defaultValue={product.slug}
            required
          />
          <p className="adm-help">
            Lowercase letters, numbers and hyphens only. /shop/&lt;slug&gt;/
          </p>
        </div>

        <div className="adm-grid-2">
          <div className="adm-field">
            <label htmlFor="priceDollars" className="adm-label">
              Price (USD)
            </label>
            <input
              id="priceDollars"
              name="priceDollars"
              type="number"
              step="0.01"
              min="0"
              className="adm-input"
              defaultValue={(product.priceCents / 100).toFixed(2)}
              required
            />
          </div>
          <div className="adm-field">
            <label htmlFor="perOrderLimit" className="adm-label">
              Per-order limit
            </label>
            <input
              id="perOrderLimit"
              name="perOrderLimit"
              type="number"
              step="1"
              min="1"
              className="adm-input"
              defaultValue={product.perOrderLimit}
              required
            />
          </div>
        </div>

        <div className="adm-field adm-field-row">
          <input
            id="oneSize"
            name="oneSize"
            type="checkbox"
            defaultChecked={product.oneSize}
            className="adm-checkbox"
          />
          <label htmlFor="oneSize">One size fits most</label>
        </div>

        <div className="adm-field">
          <label htmlFor="description" className="adm-label">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            className="adm-textarea"
            rows={3}
            defaultValue={product.description}
          />
        </div>

        <div className="adm-field">
          <label htmlFor="metaDescription" className="adm-label">
            Meta description
          </label>
          <textarea
            id="metaDescription"
            name="metaDescription"
            className="adm-textarea"
            rows={2}
            maxLength={155}
            defaultValue={product.metaDescription}
            onChange={(e) => setMetaLength(e.target.value.length)}
          />
          <p className="adm-help" aria-live="polite">
            {metaLength}/155
          </p>
        </div>

        <div className="adm-field">
          <label htmlFor="limitedNote" className="adm-label">
            Limited note
          </label>
          <input
            id="limitedNote"
            name="limitedNote"
            type="text"
            className="adm-input"
            defaultValue={product.limitedNote}
          />
        </div>

        <div className="adm-field">
          <label htmlFor="details" className="adm-label">
            Details (one per line)
          </label>
          <textarea
            id="details"
            name="details"
            className="adm-textarea"
            rows={6}
            defaultValue={product.details.join("\n")}
          />
        </div>

        <div className="adm-field">
          <label htmlFor="fit" className="adm-label">
            Fit
          </label>
          <textarea
            id="fit"
            name="fit"
            className="adm-textarea"
            rows={2}
            defaultValue={product.fit ?? ""}
          />
        </div>

        <div className="adm-field">
          <label htmlFor="limitedCopy" className="adm-label">
            Limited copy
          </label>
          <textarea
            id="limitedCopy"
            name="limitedCopy"
            className="adm-textarea"
            rows={3}
            defaultValue={product.limitedCopy ?? ""}
          />
        </div>

        <div className="adm-field">
          <label htmlFor="why" className="adm-label">
            Why
          </label>
          <textarea
            id="why"
            name="why"
            className="adm-textarea"
            rows={3}
            defaultValue={product.why ?? ""}
          />
        </div>

        <div className="adm-field">
          <label htmlFor="authenticityCopy" className="adm-label">
            Authenticity copy
          </label>
          <textarea
            id="authenticityCopy"
            name="authenticityCopy"
            className="adm-textarea"
            rows={3}
            defaultValue={product.authenticityCopy ?? ""}
          />
        </div>

        <div className="adm-field">
          <span className="adm-label">Authenticity facts</span>
          <AuthFactFields product={product} />
        </div>

        {saveState?.error && (
          <p className="adm-error" role="alert">
            {saveState.error}
          </p>
        )}
      </form>

      <div className="adm-editor-footer">
        <button
          type="submit"
          form="product-form"
          className="adm-btn adm-btn-primary"
          disabled={savePending}
        >
          {savePending ? "Saving…" : "Save"}
        </button>

        {saveState?.ok && saveState.savedAt && (
          <span className="adm-saved-note">
            Saved ·{" "}
            {new Date(saveState.savedAt).toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
        )}

        {product.status === "published" && (
          <a href={`/shop/${product.slug}/`} target="_blank" rel="noreferrer" className="adm-btn">
            View on site →
          </a>
        )}

        <form action={statusFormAction} className="adm-inline-form">
          <input type="hidden" name="id" value={product.id} />
          <input type="hidden" name="status" value={nextToggleStatus} />
          <button type="submit" className="adm-btn" disabled={statusPending}>
            {currentStatus === "published" ? "Unpublish" : "Publish"}
          </button>
        </form>

        <form action={statusFormAction} className="adm-inline-form">
          <input type="hidden" name="id" value={product.id} />
          <input type="hidden" name="status" value="archived" />
          <button
            type="submit"
            className="adm-btn adm-btn-danger"
            disabled={statusPending}
            onClick={(e) => {
              if (!archiveArmed) {
                e.preventDefault();
                setArchiveArmed(true);
              }
            }}
          >
            {archiveArmed ? "Really archive?" : "Archive"}
          </button>
        </form>

        {statusState?.error && (
          <p className="adm-error" role="alert">
            {statusState.error}
          </p>
        )}
      </div>
    </>
  );
}
