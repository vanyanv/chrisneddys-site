"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CapArt } from "./CapArt";
import {
  bagSubtotal,
  closeBag,
  removeFromBag,
  setBagQty,
  useBag,
  type BagLine,
} from "./bagStore";
import { MAX_PER_ORDER, TERMS_PENDING, money, productBySlug } from "@/data/merch";
import { track, type TrackItem } from "@/lib/track";

/** How long the remove animation runs before the line actually leaves the store. */
const REMOVE_MS = 280;

/**
 * The bag, as a drawer over whatever you were looking at.
 *
 * It is deliberately not a page. Adding a second cap should never cost you your
 * place on the one you were reading, and there is no `/shop/bag/` URL worth
 * bookmarking — a bag is a session, not a document.
 *
 * Mounted once in the root layout so it can be opened from the header on any
 * page. It renders nothing at all until it is open, so the cost to every other
 * page on the site is the component's own bytes and no DOM.
 */
export function BagDrawer() {
  const { lines, open } = useBag();
  const panel = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // `mounted` runs one frame behind `open` so the panel can start off-screen and
  // transition in. Setting both in the same frame would paint it already there.
  useEffect(() => {
    if (!open) {
      setMounted(false);
      return;
    }
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, [open]);

  const dismiss = useCallback(() => {
    closeBag();
    returnFocus.current?.focus?.();
  }, []);

  // Escape closes, and focus moves into the panel on open so the next Tab lands
  // inside the dialog rather than back at the top of the page behind it.
  useEffect(() => {
    if (!open) return;
    returnFocus.current = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    document.addEventListener("keydown", onKey);
    const id = requestAnimationFrame(() => {
      panel.current?.querySelector<HTMLElement>("button, a")?.focus();
    });
    return () => {
      document.removeEventListener("keydown", onKey);
      cancelAnimationFrame(id);
    };
  }, [open, dismiss]);

  // Opening the bag is the closest thing this shop has to a checkout step
  // while payment is still off, so it is worth a baseline. Keyed on `open`
  // alone: changing a quantity while the drawer is up is not a second view.
  useEffect(() => {
    if (!open) return;
    const items: TrackItem[] = lines.flatMap((line) => {
      const product = productBySlug(line.slug);
      return product
        ? [
            {
              item_id: product.slug,
              item_name: product.name,
              price: product.price,
              quantity: line.qty,
            },
          ]
        : [];
    });
    track("view_cart", { currency: "USD", value: bagSubtotal(lines), items });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // The page behind a modal must not scroll under it.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const drop = useCallback((slug: string) => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      removeFromBag(slug);
      return;
    }
    setRemoving(slug);
    window.setTimeout(() => {
      removeFromBag(slug);
      setRemoving(null);
    }, REMOVE_MS);
  }, []);

  if (!open) return null;

  const subtotal = bagSubtotal(lines);

  return (
    <div className="cne-bag-root">
      <button
        type="button"
        className={`cne-bag-scrim${mounted ? " is-in" : ""}`}
        aria-label="Close bag"
        onClick={dismiss}
      />
      <div
        className={`cne-drawer${mounted ? " is-in" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cne-bag-title"
        ref={panel}
      >
        <div className="cne-dr-head">
          <h2 id="cne-bag-title">YOUR BAG</h2>
          <button type="button" className="cne-dr-x" onClick={dismiss} aria-label="Close bag">
            &times;
          </button>
        </div>

        <div className="cne-dr-body">
          <ul className="cne-bag-lines">
            {lines.map((line, i) => (
              <BagRow
                key={line.slug}
                line={line}
                index={i}
                removing={removing === line.slug}
                onRemove={() => drop(line.slug)}
              />
            ))}
          </ul>
        </div>

        <div className="cne-dr-foot">
          {/* Subtotal only. A "Total" line that quietly omits shipping and tax
              is a smaller number than the one the buyer would actually pay, and
              neither has been set yet — so the bag shows what it knows and says
              what it doesn't. */}
          <div className="cne-tot">
            <div className="grand">
              <span>Subtotal</span>
              <span>{money(subtotal)}</span>
            </div>
          </div>
          <p className="cne-dr-note is-terms">{TERMS_PENDING}</p>

          {/* Payment is not connected yet, so the button says so rather than
              leading somewhere that cannot take money. It is sized and placed
              exactly where the live one goes: wiring it up changes this element
              and nothing above it. */}
          <button type="button" className="cne-btn-primary is-dead" disabled>
            CHECKOUT — OPENING SOON
          </button>
          <p className="cne-dr-note">
            The shop is not taking payment yet. Your bag is saved on this device.
          </p>
          <Link href="/shop/" className="cne-btn-ghost" onClick={dismiss}>
            Keep shopping
          </Link>
        </div>
      </div>
    </div>
  );
}

function BagRow({
  line,
  index,
  removing,
  onRemove,
}: {
  line: BagLine;
  index: number;
  removing: boolean;
  onRemove: () => void;
}) {
  const product = productBySlug(line.slug);
  if (!product) return null;

  return (
    <li
      className={`cne-li${removing ? " is-out" : ""}`}
      style={{ "--cne-li-i": index } as React.CSSProperties}
    >
      <div className="cne-li-art">
        <CapArt />
      </div>
      <div className="cne-li-b">
        <span className="n">{product.displayName[1]}</span>
        <span className="v">
          LIMITED RUN{product.oneSize ? " · ONE SIZE" : ""}
        </span>
        <div className="cne-li-ft">
          <div className="cne-qty-sm">
            <button
              type="button"
              onClick={() => setBagQty(line.slug, line.qty - 1)}
              aria-label={`Decrease ${product.name} quantity`}
            >
              &minus;
            </button>
            <span aria-live="polite">{line.qty}</span>
            <button
              type="button"
              onClick={() => setBagQty(line.slug, line.qty + 1)}
              disabled={line.qty >= MAX_PER_ORDER}
              aria-label={`Increase ${product.name} quantity`}
            >
              +
            </button>
          </div>
          <span className="cne-price">{money(product.price * line.qty)}</span>
        </div>
        <button type="button" className="cne-li-rm" onClick={onRemove}>
          Remove
        </button>
      </div>
    </li>
  );
}
