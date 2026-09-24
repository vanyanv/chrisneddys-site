"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CapArt } from "./CapArt";
import {
  bagSubtotal,
  closeBag,
  reloadBag,
  removeFromBag,
  setBagQty,
  useBag,
  type BagLine,
} from "./bagStore";
import { formatPrice } from "@/lib/otter";
import { track, type TrackItem } from "@/lib/track";
import { getGaIdentity } from "@/lib/gaIdentity";
import { Monster } from "@/components/mascots/Monster";

/** How long the remove animation runs before the line actually leaves the store. */
const REMOVE_MS = 280;

type Fulfilment = "ship" | "pickup";

/** `/api/checkout`'s error shape — a human message, and (when it came from a
 * `QuoteLineError`) the machine code the message was built from. */
type CheckoutErrorBody = { error?: string; code?: string };

/** GA4's ecommerce line item, from a bag line's own snapshot — display-only,
 * same as the rest of the line, so this can drift from what checkout
 * actually charges. */
function lineItem(line: BagLine): TrackItem {
  return {
    item_id: line.slug,
    item_name: line.name,
    price: line.priceCents / 100,
    quantity: line.qty,
  };
}

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
 *
 * `shopOpen`, `pickupEnabled` and `shippingNote` are read server-side
 * (`isShopOpenFor(settings)`, the store settings row, and
 * `shippingReturnsNote(settings)` — see the `(site)` root layout) and passed
 * down as plain props: this is a client component, so it cannot read the env
 * or the database itself. `shippingNote` is the real "Shipping & returns"
 * line once the shop is open, or the `TERMS_PENDING` placeholder otherwise —
 * the layout decides which, so this component only ever renders whichever
 * string it's given.
 */
export function BagDrawer({
  shopOpen,
  pickupEnabled,
  shippingNote,
}: {
  shopOpen: boolean;
  pickupEnabled: boolean;
  shippingNote: string | null;
}) {
  const { lines, open } = useBag();
  const panel = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [fulfilment, setFulfilment] = useState<Fulfilment>("ship");
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutPending, setCheckoutPending] = useState(false);

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

  // Safari (every iPhone browser) keeps the page alive in its back-forward
  // cache when checkout leaves for Stripe, so Back restores it mid-"TAKING YOU
  // TO CHECKOUT…" with the button disabled. Nothing is in flight by then. The
  // bag is re-read first: if the order was paid, the thanks page emptied it.
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return;
      reloadBag();
      setCheckoutPending(false);
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

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
    const items: TrackItem[] = lines.map(lineItem);
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

  const drop = useCallback((line: BagLine) => {
    // Reported on the tap, same as `add_to_cart` — the whole line goes,
    // regardless of the reduced-motion branch below skipping the animation.
    track("remove_from_cart", {
      currency: "USD",
      value: (line.priceCents / 100) * line.qty,
      items: [lineItem(line)],
    });
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      removeFromBag(line.slug);
      return;
    }
    setRemoving(line.slug);
    window.setTimeout(() => {
      removeFromBag(line.slug);
      setRemoving(null);
    }, REMOVE_MS);
  }, []);

  const checkout = useCallback(async () => {
    if (checkoutPending || lines.length === 0) return;
    setCheckoutError(null);
    setCheckoutPending(true);

    const items: TrackItem[] = lines.map(lineItem);
    track("begin_checkout", { currency: "USD", value: bagSubtotal(lines), items });
    const ga = await getGaIdentity();

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: lines.map((line) => ({ slug: line.slug, quantity: line.qty })),
          fulfilment,
          ga,
        }),
      });

      if (!res.ok) {
        const body: CheckoutErrorBody = await res.json().catch(() => ({}));
        setCheckoutError(body.error ?? "Something went wrong. Please try again.");
        setCheckoutPending(false);
        return;
      }

      const body: { url?: string } = await res.json().catch(() => ({}));
      if (!body.url) {
        setCheckoutError("Something went wrong. Please try again.");
        setCheckoutPending(false);
        return;
      }

      // Leaving the page for Stripe's hosted checkout — `checkoutPending`
      // stays true so the button can't be tapped again mid-navigation.
      window.location.assign(body.url);
    } catch {
      setCheckoutError("Couldn't reach the shop. Check your connection and try again.");
      setCheckoutPending(false);
    }
  }, [checkoutPending, lines, fulfilment]);

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
          {lines.length === 0 ? (
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "flex-end",
                }}
              >
                <Monster species="bubble" bodyColor="#e63027" irisColor="#2e5fd9" size={30} />
                <span style={{ marginLeft: "-6px", marginBottom: "-4px" }}>
                  <Monster species="bubble" bodyColor="#f5b82e" irisColor="#e63027" size={22} />
                </span>
              </div>
              <p className="cne-dr-note">Nothing in the bag yet.</p>
            </div>
          ) : (
            <ul className="cne-bag-lines">
              {lines.map((line, i) => (
                <BagRow
                  key={line.slug}
                  line={line}
                  index={i}
                  removing={removing === line.slug}
                  onRemove={() => drop(line)}
                />
              ))}
            </ul>
          )}
        </div>

        <div className="cne-dr-foot">
          {/* Subtotal only. A "Total" line that quietly omits shipping and tax
              is a smaller number than the one the buyer would actually pay, and
              neither has been set yet — so the bag shows what it knows and says
              what it doesn't. */}
          <div className="cne-tot">
            <div className="grand">
              <span>Subtotal</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
          </div>
          {shippingNote && <p className="cne-dr-note is-terms">{shippingNote}</p>}

          {shopOpen ? (
            <>
              {pickupEnabled && (
                <fieldset
                  className="cne-fulfil"
                  style={{ border: 0, padding: 0, margin: "0 0 12px" }}
                >
                  <legend style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, padding: 0 }}>
                    How do you want it?
                  </legend>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                    <input
                      type="radio"
                      name="cne-fulfilment"
                      value="ship"
                      checked={fulfilment === "ship"}
                      onChange={() => setFulfilment("ship")}
                    />
                    Ship to me
                  </label>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 14,
                      marginTop: 4,
                    }}
                  >
                    <input
                      type="radio"
                      name="cne-fulfilment"
                      value="pickup"
                      checked={fulfilment === "pickup"}
                      onChange={() => setFulfilment("pickup")}
                    />
                    Pick up in store
                  </label>
                </fieldset>
              )}

              {checkoutError && (
                <p className="cne-dr-note" role="alert" style={{ color: "var(--a-red, #e63027)" }}>
                  {checkoutError}
                </p>
              )}

              <button
                type="button"
                className="cne-btn-primary"
                onClick={checkout}
                disabled={checkoutPending}
                style={{ cursor: checkoutPending ? "wait" : "pointer" }}
              >
                {checkoutPending ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                    TAKING YOU TO CHECKOUT…
                    <Monster species="classic" bodyColor="#e63027" irisColor="#2e5fd9" size={40} />
                  </span>
                ) : (
                  "CHECKOUT"
                )}
              </button>
              <p className="cne-dr-note">
                You&rsquo;ll pay on Stripe&rsquo;s secure checkout page.
              </p>
            </>
          ) : (
            <>
              {/* Payment is not connected yet, so the button says so rather
                  than leading somewhere that cannot take money. */}
              <button type="button" className="cne-btn-primary is-dead" disabled>
                CHECKOUT — OPENING SOON
              </button>
              <p className="cne-dr-note">
                The shop is not taking payment yet. Your bag is saved on this device.
              </p>
            </>
          )}
          <Link prefetch={false} href="/shop/" className="cne-btn-ghost" onClick={dismiss}>
            Keep shopping
          </Link>
          <Link
            prefetch={false}
            href="/shop/order/"
            className="cne-btn-ghost is-sub"
            onClick={dismiss}
          >
            Already ordered? Track it
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
  return (
    <li
      className={`cne-li${removing ? " is-out" : ""}`}
      style={{ "--cne-li-i": index } as React.CSSProperties}
    >
      <div className="cne-li-art">
        {line.image ? (
          <div className="cne-capshot is-photo">
            <img src={line.image.url} alt={line.image.alt} loading="lazy" decoding="async" />
          </div>
        ) : (
          <CapArt />
        )}
      </div>
      <div className="cne-li-b">
        {/* Both halves, joined: `displayName` is split for the two-line
            treatment on the shop grid and the product page, and taking only
            [1] here left the bag reading "— BLUE". Same one-line form the
            breadcrumb and the JSON-LD use. */}
        <span className="n">{line.displayName.join(" ")}</span>
        <span className="v">LIMITED RUN</span>
        <div className="cne-li-ft">
          <div className="cne-qty-sm">
            <button
              type="button"
              onClick={() => {
                const next = line.qty - 1;
                // The minus button is also the delete once it reaches zero
                // (`setBagQty` drops the line) — report it the same as the
                // Remove link, not as a silent decrement to nothing.
                if (next <= 0) {
                  track("remove_from_cart", {
                    currency: "USD",
                    value: (line.priceCents / 100) * line.qty,
                    items: [lineItem(line)],
                  });
                }
                setBagQty(line.slug, next);
              }}
              aria-label={`Decrease ${line.name} quantity`}
            >
              &minus;
            </button>
            <span aria-live="polite">{line.qty}</span>
            <button
              type="button"
              onClick={() => setBagQty(line.slug, line.qty + 1)}
              disabled={line.qty >= line.perOrderLimit}
              aria-label={`Increase ${line.name} quantity`}
            >
              +
            </button>
          </div>
          <span className="cne-price">{formatPrice((line.priceCents / 100) * line.qty)}</span>
        </div>
        <button type="button" className="cne-li-rm" onClick={onRemove}>
          Remove
        </button>
      </div>
    </li>
  );
}
