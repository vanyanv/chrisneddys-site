"use client";

import { useState } from "react";
import { Monster } from "@/components/mascots/Monster";
import { ProductShot } from "./ProductShot";
import { firstView, type MerchProduct } from "@/data/merch";

/**
 * The product gallery.
 *
 * The strip only appears once `views` has more than one entry — a single
 * photograph doesn't need eight labelled angles of itself. The Foam Trucker
 * has eight real views lined up (front, 3/4, button, stitch, snap, back), each
 * with its own caption, even though none of them has a photograph behind it
 * yet: every tab renders `CapArt` until `scripts/build-shop-images.mjs` has
 * something to point at instead.
 *
 * `#cne-pdp-shot` is the id `flyToBag` looks for. Keeping the handle on the DOM
 * rather than passing a ref means the buy controls and the gallery do not have
 * to know about each other.
 */
export function ProductGallery({
  product,
  soldOut = false,
}: {
  product: MerchProduct;
  /** From the catalogue's live inventory — desaturates the main shot and
   * labels it, rather than hiding the page (see the product page and issue
   * #36 phase 6: a finished run keeps its photo, not just its listing). */
  soldOut?: boolean;
}) {
  const [active, setActive] = useState(0);
  const view = product.views[active] ?? firstView(product);
  const hasStrip = product.views.length > 1;

  return (
    <div className="cne-pdp-gal">
      <div className={`cne-pdp-main${soldOut ? " is-soldout" : ""}`} id="cne-pdp-shot">
        {soldOut && <span className="cne-pdp-gone">All gone</span>}
        {/* Same not-sold-out signal the index card's badge uses — see
            `shop/page.tsx` for why there's no dedicated limited/exclusive
            field to gate on instead. */}
        {!soldOut && (
          <Monster
            species="classic"
            bodyColor="#2e5fd9"
            irisColor="#e63027"
            size={26}
            className="cne-badge-corner is-tr"
          />
        )}
        {/* Keyed on the view so the crossfade replays when the angle changes. */}
        <ProductShot
          key={view?.id ?? "none"}
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
              <ProductShot product={product} view={v} sizes="120px" thumb />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
