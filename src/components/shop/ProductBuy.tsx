"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { addToBag, openBag } from "./bagStore";
import { flyToBag } from "./flyToBag";
import { MAX_PER_ORDER, money, type MerchProduct } from "@/data/merch";

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
};

const Ctx = createContext<BuyContext | null>(null);

function useBuy(): BuyContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("Buy controls must be rendered inside <BuyProvider>");
  return ctx;
}

export function BuyProvider({
  product,
  children,
}: {
  product: MerchProduct;
  children: React.ReactNode;
}) {
  const [qty, setQtyRaw] = useState(1);
  const [added, setAdded] = useState(false);

  const setQty = useCallback((n: number) => {
    setQtyRaw(Math.max(1, Math.min(MAX_PER_ORDER, n)));
  }, []);

  const add = useCallback(() => {
    // The bag is updated on arrival, not on click: the flying cap and the
    // counter incrementing are the same event, and splitting them reads as two.
    const source = document.getElementById("cne-pdp-shot");
    setAdded(true);
    window.setTimeout(() => setAdded(false), 900);
    flyToBag(source, () => {
      addToBag(product.slug, qty);
      setQtyRaw(1);
      openBag();
    });
  }, [product.slug, qty]);

  const value = useMemo(
    () => ({ product, qty, setQty, add, added }),
    [product, qty, setQty, add, added],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** The desktop stepper + primary button. */
export function BuyRow() {
  const { product, qty, setQty, add, added } = useBuy();

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
          disabled={qty >= MAX_PER_ORDER}
          aria-label="Increase quantity"
        >
          +
        </button>
      </div>
      <button type="button" className="cne-btn-primary" onClick={add}>
        {added ? "ADDED ✓" : `ADD TO BAG — ${money(product.price * qty)}`}
      </button>
    </div>
  );
}

/**
 * The phone's sticky buy bar. Hidden above the breakpoint by CSS rather than by
 * a media query in JS, so it is correct in the first frame and on resize.
 */
export function StickyBuy() {
  const { product, add, added, qty } = useBuy();

  return (
    <div className="cne-pdp-sticky">
      <span className="cne-price p">{money(product.price * qty)}</span>
      <button type="button" className="cne-btn-primary" onClick={add}>
        {added ? "ADDED ✓" : "ADD TO BAG"}
      </button>
    </div>
  );
}
