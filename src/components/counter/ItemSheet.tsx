"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MenuItem, WayId } from "@/data/menu";
import { ways, extras, photoFor } from "@/data/menu";
import { buildFor } from "@/data/build";
import { framingFor } from "@/data/photoFocus";
import { menuPhotoImageSet } from "@/lib/menuPhoto";
import { FEATURED_OTTER_IDS } from "@/data/featured";
import { comboFor } from "@/data/upsell";
import { formatPrice, itemPhotoAlt, priceString } from "@/lib/otter";
import { Monster } from "@/components/mascots/Monster";
import { MONSTER_COLORS } from "@/components/mascots/monsterColors";
import { OrderLink } from "@/components/order/OrderLink";
import { WayPicker } from "./WayPicker";
import "@/styles/item-sheet.css";

type Props = {
  item: MenuItem | null;
  /**
   * Separate from `item` on purpose: the item stays mounted after closing so
   * the sheet keeps its height, which is what the slide animates against.
   */
  open: boolean;
  way: WayId;
  onWayChange: (id: WayId) => void;
  onClose: () => void;
  /** Swap the sheet to another item (the combo suggestion). */
  onSwitch?: (item: MenuItem) => void;
};

/**
 * Everything the browser will Tab to, in document order.
 *
 * The `[tabindex="-1"]` exclusion covers buttons as well: the Way picker is a
 * radio group, so the unselected radio is a real `<button>` held out of the tab
 * order. Counting it as a stop would put the trap's "last" element one short.
 */
const FOCUSABLE =
  'a[href], button:not([disabled]):not([tabindex="-1"]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** How far down the sheet has to travel before letting go dismisses it. */
const DISMISS_RATIO = 0.33;
/** A flick counts even when it is short: px per ms, downward. */
const FLICK_VELOCITY = 0.5;

/**
 * The menu board: bottom sheet on a phone, right-hand panel on desktop — same
 * component, the breakpoint does the rest. Styles in `item-sheet.css`.
 *
 * The sheet exists because Otter can't take preselected modifiers through a
 * link. Rather than make someone choose toppings twice, it names the exact
 * checkboxes waiting on the next screen, then hands off to that one item.
 */
export function ItemSheet({ item, open, way, onWayChange, onClose, onSwitch }: Props) {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const id = requestAnimationFrame(() => closeRef.current?.focus({ preventScroll: true }));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      // `aria-modal` tells a screen reader the rest of the page is gone; it
      // does not stop Tab from walking into it. Without this, the tab after
      // ADD TO ORDER lands on a menu row behind the scrim.
      if (e.key !== "Tab") return;
      const sheet = sheetRef.current;
      if (!sheet) return;
      const stops = Array.from(sheet.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.getClientRects().length > 0,
      );
      if (stops.length === 0) return;
      const first = stops[0];
      const last = stops[stops.length - 1];
      const active = document.activeElement;
      const outside = !(active instanceof Node) || !sheet.contains(active);
      if (e.shiftKey ? active === first || outside : active === last || outside) {
        e.preventDefault();
        // `stops.length === 0` returned above, so first/last are defined here.
        (e.shiftKey ? last : first)?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    // The page behind a modal shouldn't scroll under it.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(id);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      restoreRef.current?.focus?.({ preventScroll: true });
    };
  }, [open, onClose]);

  /**
   * Drag to dismiss.
   *
   * The grab bar has always been drawn here, and on a phone that bar is the
   * universal promise of swipe-to-dismiss. Nothing was listening, so the
   * gesture did nothing and the only way out was a small ✕ in the corner.
   *
   * The listeners sit on the bar rather than on the whole sheet on purpose:
   * the body below it scrolls, and a drag handler spanning both has to guess
   * every frame whether a downward move means "scroll the list" or "close
   * this", which is how sheets end up feeling unreliable.
   */
  const drag = useRef<{ id: number; y0: number; t0: number; dy: number } | null>(null);
  /* State rather than a `classList.add`. React owns `className` on the sheet,
     so an imperative class is wiped by the next render — which happens partway
     through the very first gesture, taking the pointer capture with it and
     dropping the release onto the scrim behind. */
  const [dragging, setDragging] = useState(false);

  /* The offset goes through a custom property instead. Nothing passes a `style`
     prop to the sheet, so React never touches it and it survives renders. */
  const setOffset = useCallback((px: number) => {
    sheetRef.current?.style.setProperty("--cne-drag", `${px}px`);
  }, []);

  const onGrabDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    // Stops the mousedown/click emulation this gesture would otherwise end in,
    // and the text selection that comes with dragging across the sheet.
    e.preventDefault();
    drag.current = { id: e.pointerId, y0: e.clientY, t0: e.timeStamp, dy: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  };

  const onGrabMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    // Downward only. Pulling up on a sheet that is already at its top should
    // do nothing rather than lift it off the bottom of the screen.
    d.dy = Math.max(0, e.clientY - d.y0);
    setOffset(d.dy);
  };

  const endGrab = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    setDragging(false);
    const height = sheetRef.current?.getBoundingClientRect().height ?? 0;
    const velocity = d.dy / Math.max(1, e.timeStamp - d.t0);
    if (d.dy > height * DISMISS_RATIO || velocity > FLICK_VELOCITY) {
      // Let the close transition carry it the rest of the way from where the
      // finger left it, rather than snapping back first and then sliding out.
      onClose();
    } else {
      setOffset(0);
    }
  };

  /* A sheet dragged halfway and dismissed must not reopen halfway. Zeroing on
     *close* rather than on open is what keeps that invisible: the moment `open`
     goes false the `.is-open` rule that reads --cne-drag stops applying, so the
     sheet is already heading for translateY(102%) and resetting the variable
     costs nothing. Doing it on open would leave one frame where the sheet
     jumps to the old offset instead of sliding up from the bottom. */
  useEffect(() => {
    if (!open) setOffset(0);
  }, [open, setOffset]);

  const selected = ways.find((w) => w.id === way) ?? ways[0];
  const build = item ? buildFor(item.id) : undefined;
  const combo = item ? comboFor(item) : undefined;
  /* A combo shot both ways shows the one being picked (issue #208). */
  const photo = item ? photoFor(item, way) : undefined;
  /* The home page's "MOST ORDERED" card, not a second opinion: the same item
     wears the same label in both places. */
  const mostOrdered = item?.otterId === FEATURED_OTTER_IDS[0];
  /* `taps` are the Otter checkbox labels verbatim, which is right when the copy
     is telling you what to press. The board is listing what is in the bag, so
     it wants the thing rather than the instruction: "Add Lettuce" → "Lettuce". */
  const freeToppings = selected.taps.map((t) => t.replace(/^Add /, ""));
  /* The front monster is the Way's own (Chris red, Eddy blue); an item with no
     Way gets the yellow one up front instead. */
  const front = item?.takesToppings ? (way === "eddy" ? "blue" : "red") : "yellow";
  const back = front === "yellow" ? "blue" : "yellow";

  return (
    <>
      <div className={`cne-scrim${open ? " is-open" : ""}`} onClick={onClose} aria-hidden="true" />
      <div
        ref={sheetRef}
        className={`cne-sheet${open ? " is-open" : ""}${dragging ? " is-dragging" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={item ? item.name : "Item"}
        inert={!open}
      >
        {/* The checkerboard trim along the top of the menu board. */}
        <div className="cne-board-trim" aria-hidden="true" />
        <div
          className="cne-sheet-grab"
          aria-hidden="true"
          onPointerDown={onGrabDown}
          onPointerMove={onGrabMove}
          onPointerUp={endGrab}
          onPointerCancel={endGrab}
        >
          {/* The bar itself is drawn by ::before, so this element can be the
              tall hit area a thumb actually needs. Not focusable: the keyboard
              route out is Escape and the ✕, and a tab stop that only works
              with a pointer is a tab stop that does nothing. */}
        </div>
        <button ref={closeRef} className="cne-xbtn" onClick={onClose} aria-label="Close">
          ✕
        </button>

        <div className="cne-sheet-body">
          {item && (
            <>
              {/* The shot stays a bare `role="img"` element and the name sits
                  outside it: a `role="img"` subtree is not exposed to a screen
                  reader, so text nested in there would be lost. */}
              <div className="cne-board-pic">
                <span className="cne-board-peek" aria-hidden="true">
                  <Monster
                    species="classic"
                    bodyColor={MONSTER_COLORS[front].body}
                    irisColor={MONSTER_COLORS[front].iris}
                    size={64}
                    className={`is-front${front === "blue" ? " is-flip" : ""}`}
                  />
                  <Monster
                    species="classic"
                    bodyColor={MONSTER_COLORS[back].body}
                    irisColor={MONSTER_COLORS[back].iris}
                    size={50}
                    className={`is-back${back === "blue" ? " is-flip" : ""}`}
                  />
                </span>
                <div className="cne-board-frame">
                  <div
                    className={`cne-sheet-shot${photo ? " is-photo" : ""}`}
                    style={
                      photo
                        ? ({
                            /* The 720 WebP for every browser, and the
                               sharpest cut that exists, AVIF first, where
                               `image-set()` takes `type()` (item-sheet.css). */
                            "--cne-shot-url": `url(/menu/${photo}.webp)`,
                            "--cne-shot-set": menuPhotoImageSet(photo),
                            /* Per-photo framing — see photoFocus.ts. The CSS
                               carries a fallback for both, so a photo missing
                               from that map still renders sensibly. */
                            "--cne-shot-focus": `${framingFor(photo)[0]}%`,
                            "--cne-shot-zoom": `${framingFor(photo)[1]}%`,
                          } as React.CSSProperties)
                        : undefined
                    }
                    role="img"
                    aria-label={itemPhotoAlt(item)}
                  />
                  {mostOrdered && <span className="cne-board-most">MOST ORDERED</span>}
                </div>
              </div>

              {/* Name, dotted leader, price: a line off the menu board. The
                  price drops its "$" the way a board does; the button below
                  still says it in full, and a screen reader hears it here. */}
              <div className="cne-board-hd">
                <h3 className="cne-sheet-name">{item.name}</h3>
                <i aria-hidden="true" />
                {/* Every location charges the same pickup price (owner,
                    2026-09-26), so the label names the price, not a store. */}
                <span className="cne-board-price">
                  <small>Pickup</small>
                  <span>
                    <span className="cne-sr-only">$</span>
                    {priceString(item.price)}
                  </span>
                </span>
              </div>
              {item.desc && <p className="cne-sheet-desc">{item.desc}</p>}

              {item.takesToppings && (
                <>
                  <p className="cne-board-lbl" id="cne-board-ways">
                    Topping style
                  </p>
                  <WayPicker
                    way={way}
                    onChange={onWayChange}
                    labelledBy="cne-board-ways"
                    className="cne-ways-board"
                  />

                  {/* What lands in the bag. Picking a Way prints that Way's
                      toppings onto the board as free lines, so the control has
                      a result you can watch. Everything the next screen offers
                      is spelled out here, extras and their prices included. */}
                  <p className="cne-board-lbl" id="cne-board-bag">
                    What lands in the bag
                  </p>
                  <div className="cne-board-list" aria-labelledby="cne-board-bag" role="group">
                    <ul>
                      {build?.map((line) => (
                        <li key={line.n}>
                          <span className="n">
                            {line.q} &times; {line.n}
                          </span>
                          <i aria-hidden="true" />
                        </li>
                      ))}
                      {freeToppings.map((t, i) => (
                        <li
                          key={t}
                          className="is-free"
                          /* Printed in order, the way a ticket comes off a
                             printer. Suppressed under reduced motion. */
                          style={{ animationDelay: `${i * 0.05}s` }}
                        >
                          <span className="n">+ {t}</span>
                          <i aria-hidden="true" />
                          <b className="v">Free</b>
                        </li>
                      ))}
                      <li className="is-total">
                        <span className="n">Total</span>
                        <i aria-hidden="true" />
                        <span className="v">{priceString(item.price)}</span>
                      </li>
                    </ul>
                    <p className="cne-board-sub">Also on the next screen</p>
                    <ul>
                      {extras.map((e) => (
                        <li key={e.name} className="is-extra">
                          <span className="n">{e.name}</span>
                          <i aria-hidden="true" />
                          <span className="v">+{priceString(e.price)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {combo && onSwitch && (
                    <button
                      type="button"
                      className="cne-board-combo"
                      onClick={() => {
                        onSwitch(combo);
                        // The button unmounts on the combo, so keep focus and
                        // scroll inside the sheet instead of dropping to <body>.
                        sheetRef.current
                          ?.querySelector<HTMLElement>(".cne-sheet-body")
                          ?.scrollTo({ top: 0 });
                        requestAnimationFrame(() =>
                          closeRef.current?.focus({ preventScroll: true }),
                        );
                      }}
                    >
                      {/* Claude-drafted label, flagged to the owner 2026-09-28. */}
                      <span className="k">Make it a combo</span>
                      <span className="c">{combo.name}</span>
                      <span className="p">
                        <span className="cne-sr-only">$</span>
                        {priceString(combo.price)} <span aria-hidden="true">&rarr;</span>
                      </span>
                    </button>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {/* The highest-intent link on the site reports as itself. It used to
            inherit the pathname, which filed every add-to-cart from the sheet
            under `/menu/`. */}
        <div className="cne-sheet-foot" data-surface="item-sheet">
          {item && (
            <>
              <OrderLink className="cne-otter" surface="item-sheet" item={item}>
                ADD TO ORDER · {formatPrice(item.price)} →
              </OrderLink>
              <p className="cne-fine">
                {item.takesToppings
                  ? "Opens your location's ordering page. Tick your Way's toppings there, all free."
                  : "Opens your location's ordering page."}
              </p>
            </>
          )}
        </div>
      </div>
    </>
  );
}
