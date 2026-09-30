"use client";

import { useState } from "react";
import type { AdminProduct, InventoryMode } from "@/lib/catalogAdmin";
import { generateProductSeoAction, setInventoryPlainAction } from "./actions";
import { RackSeoFields } from "./RackSeoFields";
import type { UsePendingChanges } from "./usePendingChanges";

const MODES: { key: InventoryMode; label: string }[] = [
  { key: "untracked", label: "Untracked" },
  { key: "quantity", label: "Count" },
  { key: "edition", label: "Numbered edition" },
];

/** "More details" at the foot of the Rack panel: eyebrow, description,
 * details, inventory mode, authenticity and search engines — everything the
 * artboard has no room for. Writes into the same `pendingApi` as the rest of
 * the panel, and reports immediate saves (the inventory mode, "Write with
 * AI") back through `onProductPatch`. */
export function RackMoreDetails({
  product,
  pendingApi,
  onProductPatch,
}: {
  product: AdminProduct;
  pendingApi: UsePendingChanges;
  onProductPatch: (patch: Partial<AdminProduct>) => void;
}) {
  const [modeBusy, setModeBusy] = useState(false);
  const [seoBusy, setSeoBusy] = useState(false);
  // Bumped after "Write with AI" writes new values, so the accordion's
  // uncontrolled `defaultValue` inputs remount and pick them up — the same
  // trick `pendingApi.resetToken` already plays on this same key.
  const [seoNonce, setSeoNonce] = useState(0);

  /** "Write with AI" — rewrites all four search-engine fields and pushes the
   * result straight into the accordion. Clears any unsaved edits to those
   * four fields first, so a stale pending value can't outrank what the
   * button just wrote once the fields remount. */
  async function generateSeo() {
    setSeoBusy(true);
    try {
      const result = await generateProductSeoAction(product.id);
      if (!result.ok) {
        pendingApi.showToast(result.error, { tone: "error" });
        return;
      }
      pendingApi.clearValue(product.id, "metaTitle");
      pendingApi.clearValue(product.id, "metaDescription");
      pendingApi.clearValue(product.id, "metaKeywords");
      pendingApi.clearValue(product.id, "socialImageAlt");
      onProductPatch(result.fields);
      setSeoNonce((n) => n + 1);
      pendingApi.showToast(
        result.source === "ai"
          ? "Written for you — edit anything you don't like."
          : "Filled in from the product. Set OPENAI_API_KEY to have these written properly.",
      );
    } finally {
      setSeoBusy(false);
    }
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
    onProductPatch({
      inventory:
        next === "untracked"
          ? { mode: "untracked" }
          : next === "quantity"
            ? { mode: "quantity", quantity: 0 }
            : {
                mode: "edition",
                editionSize: 50,
                sold: 0,
                reserved: 0,
                available: 50,
                setAside: 0,
              },
      editions:
        next === "edition"
          ? Array.from({ length: 50 }, (_, i) => ({ number: i + 1, status: "available" as const }))
          : [],
    });
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

  return (
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
              if (e.target.value === product.eyebrow) pendingApi.clearValue(product.id, "eyebrow");
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

        <RackSeoFields
          product={product}
          pendingApi={pendingApi}
          seoBusy={seoBusy}
          seoNonce={seoNonce}
          onGenerate={generateSeo}
        />
      </div>
    </details>
  );
}
