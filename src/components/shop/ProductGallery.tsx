"use client";

import { useState } from "react";
import { ProductShot } from "./ProductShot";
import type { MerchProduct } from "@/data/merch";

/**
 * The product gallery.
 *
 * One photograph today, so there is no thumbnail strip — a row of four
 * labelled "views" of the same shot would be describing angles nobody has
 * taken, with captions ("back strap and brass slide", "embroidery detail")
 * that were invented to fill it. The strip returns on its own the moment
 * `views` has more than one entry, which is the moment more shots exist.
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
        <ProductShot
          key={view.id}
          product={product}
          view={view}
          sizes="(min-width: 901px) 620px, 100vw"
          priority
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
              <ProductShot product={product} view={v} sizes="120px" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
