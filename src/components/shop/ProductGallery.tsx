"use client";

import { useState } from "react";
import { CapArt, type CapView } from "./CapArt";
import { ARTWORK_NOTE, type MerchProduct } from "@/data/merch";

/**
 * The product gallery.
 *
 * One drawing today, so there is no thumbnail strip — a row of four labelled
 * "views" of the same illustration would be describing angles nobody has
 * photographed, with captions ("back strap and brass slide", "embroidery
 * detail") that were invented to fill it. The strip returns on its own the
 * moment `views` has more than one entry, which is the moment real shots exist.
 *
 * The corner tag says plainly that this is an illustration; a drawing passed
 * off as a product shot would be the one genuinely dishonest thing on the page.
 *
 * `#cne-pdp-shot` is the id `flyToBag` looks for. Keeping the handle on the DOM
 * rather than passing a ref means the buy controls and the gallery do not have
 * to know about each other.
 */
export function ProductGallery({ product }: { product: MerchProduct }) {
  const [active, setActive] = useState(0);
  const view = product.views[active];
  const hasStrip = product.views.length > 1;

  return (
    <div className="cne-pdp-gal">
      <div className="cne-pdp-main" id="cne-pdp-shot">
        {/* Keyed on the view so the crossfade replays when the angle changes. */}
        <CapArt
          key={view.id}
          view={view.id as CapView}
          tag={ARTWORK_NOTE}
          className="is-swap"
        />
      </div>

      {hasStrip && (
        <div className="cne-pdp-thumbs" role="tablist" aria-label="Product views">
          {product.views.map((v, i) => (
            <button
              key={v.id}
              type="button"
              role="tab"
              className="cne-pdp-t"
              aria-selected={i === active}
              /* Starts with the visible label so the accessible name contains
                 it — WCAG 2.5.3, and why a voice-control user can say it. */
              aria-label={`${v.label} — ${v.caption}`}
              onClick={() => setActive(i)}
            >
              <CapArt view={v.id as CapView} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
