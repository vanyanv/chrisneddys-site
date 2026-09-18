"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { addToBag, openBag } from "./bagStore";
import { flyToBag } from "./flyToBag";
import { MAX_PER_ORDER, type MerchProduct } from "@/data/merch";
import { pauseButtonLabel } from "@/lib/shopCopy";
import { formatPrice } from "@/lib/otter";
import { track, type TrackItem } from "@/lib/track";

/** GA4's ecommerce line item, from a product. */
function lineItem(product: MerchProduct, quantity: number): TrackItem {
  return {
    item_id: product.slug,
    item_name: product.name,
    price: product.price,
    quantity,
  };
}

/**
 * The buy controls, split in two because they live in two places on the page:
 * the stepper and button sit in the right-hand column on a desktop, and a
 * sticky bar carries the price and the button on a phone, where the real one
 * has long since scrolled away.
 *
 * They share a quantity through this provider rather than each keeping their
 * own, because a stepper set to 3 that a sticky button then ignores is a bug
 * the buyer only finds in the bag. The provider is the client boundary; the
 * static half of the product page — the copy, the highlights, the specs — is
 * passed through it as children and stays server-rendered.
 */

type BuyContext = {
  product: MerchProduct;
  qty: number;
  setQty: (n: number) => void;
  add: () => void;
  /** True for the ~700ms the button spends confirming, so both copies agree. */
  added: boolean;
  /** Tracked inventory at zero. Disables both buy buttons; hides the stepper. */
  soldOut: boolean;
  /** The owner has paused the shop (`isShopPausedFor`, `shopStatus.ts`)
   * while it remains otherwise open. Distinct from `soldOut` (this
   * product's own inventory) and from pre-launch (`shopOpen` on the
   * surrounding page, which never reaches these buy controls at all — a
   * pre-launch buyer can still add to their bag, only checkout is closed).
   * Checked after `soldOut`: a run that's genuinely gone stays "SOLD OUT"
   * rather than the temporary, coming-back "paused" label. */
  paused: boolean;
  /** The disabled button's label while paused — the owner's own note
   * ("BACK THURSDAY") or the "SHOP PAUSED" fallback; see
   * `pauseButtonLabel` (`shopCopy.ts`). */
  pauseLabel: string;
  /** The stepper's ceiling — the product's own `perOrderLimit` (falling back
   * to `MAX_PER_ORDER`), or less when tracked stock is lower. */
  maxQty: number;
};

const Ctx = createContext<BuyContext | null>(null);

function useBuy(): BuyContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("Buy controls must be rendered inside <BuyProvider>");
  return ctx;
}

export function BuyProvider({
  product,
  soldOut = false,
  paused = false,
  pauseNote = null,
  maxQty,
  children,
}: {
  product: MerchProduct;
  /** From the catalogue's live inventory — never computed client-side. */
  soldOut?: boolean;
  /** From `isShopOpenFor(settings) && isShopPausedFor(settings)` on the
   * product page — never computed client-side, and never true while the
   * page is still pre-launch (see the `paused` field's own note above). */
  paused?: boolean;
  /** The owner's optional pause note, passed straight from `StoreSettings`.
   * Only read while `paused` is true. */
  pauseNote?: string | null;
  /** Omit to fall back to the product's own `perOrderLimit` (or
   * `MAX_PER_ORDER` when that's unset) — callers that also know the live
   * inventory cap (the product page) pass the smaller of the two instead. */
  maxQty?: number;
  children: React.ReactNode;
}) {
  const cappedQty = maxQty ?? product.perOrderLimit ?? MAX_PER_ORDER;
  const [qty, setQtyRaw] = useState(1);
  const [added, setAdded] = useState(false);

  // The product page is server-rendered apart from this provider, so this is
  // the first client code that knows which product is on screen. GA4's own
  // `view_item` name is used rather than a custom one so that the day the shop
  // takes money, the funnel it feeds already has history in it.
  useEffect(() => {
    track("view_item", {
      currency: "USD",
      value: product.price,
      items: [lineItem(product, 1)],
    });
  }, [product]);

  const setQty = useCallback(
    (n: number) => {
      setQtyRaw(Math.max(1, Math.min(cappedQty, n)));
    },
    [cappedQty],
  );

  const add = useCallback(() => {
    // Reported on the tap rather than inside `flyToBag`'s callback: the buyer
    // decided here, and an animation that is cut short by a navigation must not
    // be able to lose the event.
    track("add_to_cart", {
      currency: "USD",
      value: product.price * qty,
      items: [lineItem(product, qty)],
    });
    // The bag is updated on arrival, not on click: the flying cap and the
    // counter incrementing are the same event, and splitting them reads as two.
    const source = document.getElementById("cne-pdp-shot");
    setAdded(true);
    window.setTimeout(() => setAdded(false), 900);
    flyToBag(source, () => {
      addToBag(product, qty);
      setQtyRaw(1);
      openBag();
    });
  }, [product, qty]);

  const pauseLabel = useMemo(() => pauseButtonLabel(pauseNote), [pauseNote]);

  const value = useMemo(
    () => ({ product, qty, setQty, add, added, soldOut, paused, pauseLabel, maxQty: cappedQty }),
    [product, qty, setQty, add, added, soldOut, paused, pauseLabel, cappedQty],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** The desktop stepper + primary button. */
export function BuyRow() {
  const { product, qty, setQty, add, added, soldOut, paused, pauseLabel, maxQty } = useBuy();

  if (soldOut) {
    return (
      <>
        <div className="cne-pdp-row">
          <button type="button" className="cne-btn-primary is-soldout" disabled>
            SOLD OUT
          </button>
        </div>
        {/* The one working link on a page whose own button is dead
            (ShopStates.dc.html's "run finished" state, issue #50): the run
            is genuinely gone, but the shop is not. */}
        <Link prefetch={false} href="/shop/" className="cne-btn-secondary">
          See what else is in the shop
        </Link>
      </>
    );
  }

  // The pause card and the "Shop paused" pill above already said why; the
  // button itself just has to stop working, the same square dashed shape
  // `is-soldout` uses for the same reason — nothing here is a placeholder,
  // the shop just isn't taking orders for a few days.
  if (paused) {
    return (
      <div className="cne-pdp-row">
        <button type="button" className="cne-btn-primary is-paused" disabled>
          {pauseLabel}
        </button>
      </div>
    );
  }

  return (
    <div className="cne-pdp-row">
      <div className="cne-qty">
        <button
          type="button"
          onClick={() => setQty(qty - 1)}
          disabled={qty <= 1}
          aria-label="Decrease quantity"
        >
          &minus;
        </button>
        {/* Keyed so the number replays its nudge every time it changes. */}
        <span aria-live="polite" aria-atomic="true">
          <b key={qty}>{qty}</b>
        </span>
        <button
          type="button"
          onClick={() => setQty(qty + 1)}
          disabled={qty >= maxQty}
          aria-label="Increase quantity"
        >
          +
        </button>
      </div>
      <button type="button" className="cne-btn-primary" onClick={add}>
        {added ? "ADDED ✓" : `ADD TO BAG — ${formatPrice(product.price * qty)}`}
      </button>
    </div>
  );
}

/**
 * The phone's sticky buy bar. Hidden above the breakpoint by CSS rather than by
 * a media query in JS, so it is correct in the first frame and on resize.
 */
export function StickyBuy() {
  const { product, add, added, qty, soldOut, paused, pauseLabel } = useBuy();

  // Sold out replaces the whole bar rather than sitting a dead button next
  // to a price for a run that isn't selling at it any more — the same
  // footer swap ShopStates.dc.html draws for "run finished".
  if (soldOut) {
    return (
      <div className="cne-pdp-sticky">
        <Link prefetch={false} href="/shop/" className="cne-btn-secondary">
          See what else is in the shop
        </Link>
      </div>
    );
  }

  return (
    <div className="cne-pdp-sticky">
      <span className="cne-price p">{formatPrice(product.price * qty)}</span>
      {paused ? (
        <button type="button" className="cne-btn-primary is-paused" disabled>
          {pauseLabel}
        </button>
      ) : (
        <button type="button" className="cne-btn-primary" onClick={add}>
          {added ? "ADDED ✓" : "ADD TO BAG"}
        </button>
      )}
    </div>
  );
}
